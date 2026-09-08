import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { AtelierGameService } from '../atelier/atelier-game.service';
import { Socket, Server } from 'socket.io';
import { RoomService } from './room.service';
import { ImageService } from 'src/image/image.service';
import { RoomImageService } from 'src/room-image/room-image.service';
import { UserService } from 'src/user/user.service';

type PlayerRole = 'host' | 'guest';

interface RoomSocketSession {
  roomId: number;
  roomName: string;
  userId: number;
  role: PlayerRole;
}

interface SocketData {
  authenticatedUserId?: number;
  roomSession?: RoomSocketSession;
  playAgainRequested?: boolean;
}

const ROOM_NAME_PATTERN = /^[a-zA-Z0-9_-]{3,30}$/;

function socketCorsOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allowed?: boolean) => void,
) {
  const configuredOrigins = (process.env.SOCKET_CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  // Native clients do not send Origin. In development, keep localhost clients easy to use.
  const developmentOrigin =
    process.env.NODE_ENV !== 'production' &&
    !!origin &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (!origin || configuredOrigins.includes(origin) || developmentOrigin) {
    callback(null, true);
    return;
  }

  callback(new Error('Origin is not allowed by the WebSocket server'));
}

@WebSocketGateway({
  namespace: '/',
  cors: {
    origin: socketCorsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class RoomGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer() wss: Server<any, any, any, SocketData>;

  private readonly logger = new Logger(RoomGateway.name);
  private readonly pendingDisconnects = new Map<string, NodeJS.Timeout>();
  private readonly disconnectGraceMs = Math.max(
    0,
    Number(process.env.SOCKET_DISCONNECT_GRACE_MS || 10_000),
  );

  constructor(
    private readonly roomService: RoomService,
    private readonly imageService: ImageService,
    private readonly roomImageService: RoomImageService,
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    @Optional() private readonly atelierGame?: AtelierGameService,
  ) {}

  afterInit(server: Server<any, any, any, SocketData>) {
    server.use(async (client, next) => {
      try {
        const authorization = client.handshake.headers.authorization;
        const token =
          (typeof client.handshake.auth?.token === 'string' &&
            client.handshake.auth.token) ||
          (authorization?.startsWith('Bearer ')
            ? authorization.slice(7)
            : null);

        if (!token) throw new Error('Missing access token');

        const payload = await this.jwtService.verifyAsync<{ id?: number }>(
          token,
        );
        const userId = Number(payload.id);
        if (!Number.isInteger(userId) || userId <= 0) {
          throw new Error('Invalid access token payload');
        }

        const user = await this.userService.findOne(userId);
        if (!user) throw new Error('User no longer exists');

        client.data.authenticatedUserId = userId;
        next();
      } catch (error) {
        this.logger.warn(
          `Rejected WebSocket handshake ${client.id}: ${error.message}`,
        );
        const unauthorized = new Error(
          'WebSocket authentication is required',
        ) as Error & { data?: { code: string } };
        unauthorized.data = { code: 'UNAUTHORIZED' };
        next(unauthorized);
      }
    });
  }

  handleConnection(client: Socket<never, never, never, SocketData>) {
    this.logger.log(
      `Socket connected: ${client.id} (user ${client.data.authenticatedUserId})`,
    );
  }

  handleDisconnect(client: Socket<never, never, never, SocketData>) {
    const session = client.data.roomSession;
    if (!session) return;

    delete client.data.roomSession;
    const key = this.sessionKey(session);
    this.clearPendingDisconnect(key);

    const timer = setTimeout(() => {
      this.pendingDisconnects.delete(key);
      void this.finalizeDisconnection(session);
    }, this.disconnectGraceMs);
    timer.unref?.();
    this.pendingDisconnects.set(key, timer);

    this.logger.log(
      `Socket ${client.id} disconnected; keeping ${session.roomName}/${session.role} for ${this.disconnectGraceMs}ms`,
    );
  }

  onModuleDestroy() {
    for (const timer of this.pendingDisconnects.values()) clearTimeout(timer);
    this.pendingDisconnects.clear();
  }

  private sessionKey(session: RoomSocketSession): string {
    return `${session.roomId}:${session.role}:${session.userId}`;
  }

  private clearPendingDisconnect(key: string) {
    const timer = this.pendingDisconnects.get(key);
    if (timer) clearTimeout(timer);
    this.pendingDisconnects.delete(key);
  }

  private emitError(socket: Socket, code: string, message: string) {
    socket.emit('error', { code, message });
  }

  private authenticatedUserId(socket: Socket, suppliedUserId?: unknown) {
    const authenticatedUserId = Number(socket.data.authenticatedUserId);
    const requestedUserId =
      suppliedUserId === undefined
        ? authenticatedUserId
        : Number(suppliedUserId);

    if (
      !Number.isInteger(authenticatedUserId) ||
      !Number.isInteger(requestedUserId) ||
      requestedUserId !== authenticatedUserId
    ) {
      this.emitError(
        socket,
        'FORBIDDEN',
        'The userId does not match the authenticated user',
      );
      return null;
    }

    return authenticatedUserId;
  }

  private validRoomName(socket: Socket, value: unknown): value is string {
    if (typeof value === 'string' && ROOM_NAME_PATTERN.test(value)) return true;
    this.emitError(
      socket,
      'INVALID_ROOM_NAME',
      'Room name must contain 3-30 letters, numbers, underscores or hyphens',
    );
    return false;
  }

  private validString(
    socket: Socket,
    value: unknown,
    field: string,
    maxLength: number,
  ): value is string {
    if (
      typeof value === 'string' &&
      value.trim().length > 0 &&
      value.length <= maxLength
    ) {
      return true;
    }
    this.emitError(
      socket,
      'INVALID_PAYLOAD',
      `${field} must be a non-empty string of at most ${maxLength} characters`,
    );
    return false;
  }

  private validPositiveInteger(
    socket: Socket,
    value: unknown,
    field: string,
  ): boolean {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return true;
    this.emitError(
      socket,
      'INVALID_PAYLOAD',
      `${field} must be a positive integer`,
    );
    return false;
  }

  private authorizeRoomEvent(
    socket: Socket,
    roomName: unknown,
    claimedRole?: unknown,
    requiredRole?: PlayerRole,
  ): RoomSocketSession | null {
    if (!this.validRoomName(socket, roomName)) return null;
    const session = socket.data.roomSession as RoomSocketSession | undefined;
    if (
      !session ||
      session.roomName !== roomName ||
      !socket.rooms.has(roomName)
    ) {
      this.emitError(
        socket,
        'FORBIDDEN',
        'Socket is not a member of this room',
      );
      return null;
    }
    if (claimedRole !== undefined && claimedRole !== session.role) {
      this.emitError(
        socket,
        'FORBIDDEN',
        'Player role does not match this socket',
      );
      return null;
    }
    if (requiredRole && session.role !== requiredRole) {
      this.emitError(
        socket,
        'FORBIDDEN',
        `Only the ${requiredRole} can perform this action`,
      );
      return null;
    }
    return session;
  }

  private async bindSocketToRoom(
    socket: Socket,
    room: { id: number; name: string },
    userId: number,
    role: PlayerRole,
  ) {
    const previous = socket.data.roomSession as RoomSocketSession | undefined;
    if (previous && previous.roomName !== room.name) {
      await socket.leave(previous.roomName);
    }

    const session: RoomSocketSession = {
      roomId: room.id,
      roomName: room.name,
      userId,
      role,
    };
    socket.data.roomSession = session;
    socket.data.playAgainRequested = false;
    this.clearPendingDisconnect(this.sessionKey(session));
    await socket.join(room.name);
  }

  private async finalizeDisconnection(session: RoomSocketSession) {
    try {
      const activeSockets = await this.wss.in(session.roomName).fetchSockets();
      const replacementExists = activeSockets.some((candidate) => {
        const candidateSession = candidate.data.roomSession as
          | RoomSocketSession
          | undefined;
        return (
          candidateSession?.roomId === session.roomId &&
          candidateSession.userId === session.userId &&
          candidateSession.role === session.role
        );
      });
      if (replacementExists) return;

      const room = await this.roomService.findByName(session.roomName);
      if (!room || room.id !== session.roomId) return;

      const persistedUserId =
        session.role === 'host' ? room.hostplayerid : room.guestplayerid;
      if (persistedUserId !== session.userId) return;

      const gameStarted =
        room.hostcharacterid !== null || room.guestcharacterid !== null;

      if (session.role === 'guest' && !gameStarted) {
        const reopened = await this.roomService.reopenRoomAfterGuestLeaves(
          room.name,
          session.userId,
        );
        if (reopened) {
          this.wss.to(room.name).emit('guestLeftBeforeStart', {
            roomId: room.id,
            roomName: room.name,
          });
        }
        return;
      }

      const user = await this.userService.findOne(session.userId);
      this.wss.to(room.name).emit('playerDisconnected', {
        disconnectedPlayer: {
          userId: session.userId,
          username: user?.username || `User-${session.userId}`,
          role: session.role,
        },
        message: "Un joueur s'est déconnecté. La partie est terminée.",
        timestamp: new Date().toISOString(),
      });
      await this.roomImageService.removeRoomImage(room.id);
      await this.roomService.remove(room.id);
    } catch (error) {
      this.logger.error(
        `Failed to finalize disconnection for ${session.roomName}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Crée une room avec un host (méthode réutilisable)
   */
  private async createRoomWithHost(
    roomName: string,
    userId: number,
    category: string,
  ) {
    const room = await this.roomService.create({
      name: roomName,
      status: 'open',
      hostplayerid: userId,
      guestplayerid: null,
      hostcharacterid: null,
      guestcharacterid: null,
      category: category,
      mode: 'category',
      custom_library_user_id: null,
    });
    return room;
  }

  /**
   * Ajoute un guest à une room (méthode réutilisable)
   */
  private async addGuestToRoom(roomName: string, userId: number) {
    const joinedRoom = await this.roomService.addGuest(roomName, {
      guestplayerid: userId,
    });
    return joinedRoom;
  }

  /**
   * Notifie la création d'une room au host
   */
  private async notifyRoomCreation(socket: Socket, room: any, userId: number) {
    socket.emit('room created', {
      roomId: room.id,
      roomName: room.name,
      hostId: userId,
      category: room.category,
    });
  }

  /**
   * Notifie qu'un guest a rejoint la room
   */
  private async notifyGuestJoined(socket: Socket, room: any) {
    // Récupérer l'identité de l'host
    const host = await this.userService.findOne(
      parseInt(room.hostplayerid.toString()),
    );
    const guest = await this.userService.findOne(
      parseInt(room.guestplayerid.toString()),
    );
    const hostName = host ? host.username : `User-${room.hostplayerid}`;
    const guestName = guest ? guest.username : `User-${room.guestplayerid}`;
    console.log('Notify Guest Connection ', {
      roomId: room.id,
      roomName: room.name,
      hostId: room.hostplayerid,
      hostName: hostName,
      guestName: guestName,
      guestId: room.guestplayerid,
      category: room.category,
    });
    const images = await this.loadRoomImages(room);
    socket.to(room.name).emit('joined', {
      roomId: room.id,
      roomName: room.name,
      hostId: room.hostplayerid,
      hostName: hostName,
      category: room.category,
      guestName: guestName,
      guestId: room.guestplayerid,
      images: images,
      mode: room.mode,
    });
    socket.emit('joined', {
      roomId: room.id,
      roomName: room.name,
      hostId: room.hostplayerid,
      hostName: hostName,
      guestName: guestName,
      guestId: room.guestplayerid,
      category: room.category,
      images: images,
      mode: room.mode,
    });
  }

  private async loadRoomImages(room: {
    mode?: string;
    deck_id?: number | null;
    custom_library_user_id?: number | null;
    hostplayerid: number;
    category: string;
  }) {
    if (room.mode === 'custom' && room.deck_id) {
      return this.imageService.getDeckImagesById(room.deck_id);
    }
    if (room.mode === 'custom') {
      return this.imageService.findByUserId(
        room.custom_library_user_id || room.hostplayerid,
      );
    }
    return this.imageService.getUrlsByCategory(room.category);
  }
  @SubscribeMessage('create')
  async createRoom(socket: Socket, data: any) {
    console.log('🏠 Event: create room', {
      socketId: socket.id,
      roomName: data?.name,
      timestamp: new Date().toISOString(),
    });

    try {
      const userId = this.authenticatedUserId(socket, data?.userId);
      if (!userId || !this.validRoomName(socket, data?.name)) return;
      if (socket.data.roomSession) {
        this.emitError(
          socket,
          'ALREADY_IN_ROOM',
          'Leave the current room before creating another one',
        );
        return;
      }

      // Validation des données requises
      const mode = data.mode || 'category';
      if (mode !== 'category' && mode !== 'custom') {
        this.emitError(
          socket,
          'INVALID_PAYLOAD',
          'mode must be category or custom',
        );
        return;
      }

      if (mode === 'category') {
        if (!data.name || !data.userId || !data.category) {
          console.log('❌ Validation failed for create room (category):', {
            socketId: socket.id,
            missingFields: {
              name: !data.name,
              userId: !data.userId,
              category: !data.category,
            },
          });
          socket.emit('error', {
            message:
              'Missing required data: name, userId, and category are required',
          });
          return;
        }
      } else if (mode === 'custom') {
        if (!data.name || !data.userId) {
          console.log('❌ Validation failed for create room (custom):', {
            socketId: socket.id,
            missingFields: {
              name: !data.name,
              userId: !data.userId,
            },
          });
          socket.emit('error', {
            message: 'Missing required data: name and userId are required',
          });
          return;
        }
      }

      // Vérifier si la room existe déjà
      const existingRoom = await this.roomService.findByName(data.name);
      if (existingRoom) {
        console.log('⚠️ Room already exists:', {
          socketId: socket.id,
          roomName: data.name,
          existingRoomId: existingRoom.id,
        });
        socket.emit('error', { message: 'Room with this name already exists' });
        return;
      }

      let images: any[];

      if (mode === 'custom') {
        // Mode bibliothèque personnelle
        const deckId = data.deckId;

        if (deckId) {
          if (!this.validPositiveInteger(socket, deckId, 'deckId')) return;
          // Nouveau système: utiliser un deck sauvegardé
          console.log('📚 Mode custom avec deck:', { userId, deckId });

          // Vérifier que le deck existe et appartient à l'utilisateur
          const deckImages = await this.imageService.getDeckImages(
            deckId,
            userId,
          );

          if (deckImages.length < 18) {
            console.log("❌ Deck invalide ou pas assez d'images:", {
              deckId,
              count: deckImages.length,
            });
            socket.emit('error', {
              message:
                "Deck invalide ou ne contient pas assez d'images (minimum 18)",
            });
            return;
          }

          images = deckImages;
          console.log('📸 Images du deck récupérées:', {
            deckId,
            imageCount: images.length,
          });
        } else {
          // Legacy: utiliser toutes les images de l'utilisateur
          console.log('📚 Mode custom legacy: bibliothèque user:', userId);

          // Vérifier le nombre d'images
          const imageCount = await this.imageService.count(userId);
          if (imageCount < 18) {
            console.log("❌ Pas assez d'images:", {
              userId: data.userId,
              count: imageCount,
            });
            socket.emit('error', {
              message: `Vous devez avoir au moins 18 images dans votre bibliothèque (vous en avez ${imageCount})`,
            });
            return;
          }

          // Récupérer les images de la bibliothèque
          images = await this.imageService.findByUserId(userId);
          console.log('📸 Images bibliothèque récupérées:', {
            userId,
            imageCount: images.length,
          });
        }
      } else {
        if (!this.validString(socket, data.category, 'category', 50)) return;
        // Mode catégorie
        console.log('🖼️ Fetching images for category:', data.category);
        images = await this.imageService.getUrlsByCategory(data.category);
        console.log('📸 Images category retrieved:', {
          category: data.category,
          imageCount: images.length,
        });

        // Même contrôle qu'en mode custom : sans ces 18 images la partie ne
        // pourra pas démarrer, autant le dire avant de créer la room.
        if (images.length < 18) {
          console.log('❌ Catégorie insuffisante:', {
            category: data.category,
            count: images.length,
          });
          socket.emit('error', {
            message: `La catégorie "${data.category}" ne contient pas assez d'images (${images.length}/18)`,
          });
          return;
        }
      }

      console.log('📝 Creating new room in database...');
      const room = await this.roomService.create({
        name: data.name,
        status: 'open',
        hostplayerid: userId,
        guestplayerid: null,
        hostcharacterid: null,
        guestcharacterid: null,
        category: mode === 'category' ? data.category : 'custom',
        mode: mode,
        custom_library_user_id: mode === 'custom' ? userId : null,
        deck_id: data.deckId ? Number(data.deckId) : null,
      });
      console.log('✅ Room created successfully:', {
        socketId: socket.id,
        roomId: room.id,
        roomName: room.name,
        hostId: room.hostplayerid,
        mode: room.mode,
        category: room.category,
      });

      // Le créateur rejoint automatiquement sa propre room
      await this.bindSocketToRoom(socket, room, userId, 'host');
      console.log('🔗 Socket joined room:', {
        socketId: socket.id,
        roomName: data.name,
      });

      console.log('👤 Host créé la room:', {
        roomName: data.name,
        socketId: socket.id,
        userId: data.userId,
        mode: mode,
      });

      // Notifier la création de la room
      const roomData = {
        room: data.name,
        roomId: room.id,
        images: images,
        mode: mode,
      };
      console.log('📡 Emitting roomCreated event:', {
        socketId: socket.id,
        roomData: { ...roomData, images: `[${images.length} images]` },
      });
      socket.to(data.name).emit('roomCreated', roomData);
      socket.emit('roomCreated', roomData);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', { message: 'Failed to create room' });
    }
  }

  @SubscribeMessage('join')
  async joinRoom(socket: Socket, data: any) {
    console.log('🚪 Event: join room', {
      socketId: socket.id,
      roomName: data?.name,
      timestamp: new Date().toISOString(),
    });

    try {
      const userId = this.authenticatedUserId(socket, data?.userId);
      if (!userId || !this.validRoomName(socket, data?.name)) return;
      if (socket.data.roomSession) {
        this.emitError(
          socket,
          'ALREADY_IN_ROOM',
          'Leave the current room before joining another one',
        );
        return;
      }

      // Validation des données requises
      if (!data.name || !data.userId) {
        console.log('❌ Validation failed for join room:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            userId: !data.userId,
          },
        });
        socket.emit('error', {
          message: 'Missing required data: name and userId are required',
        });
        return;
      }

      // Vérifier et rejoindre la room en base de données d'abord
      console.log('📝 Adding guest to room in database...');
      const joinedRoom = await this.roomService.addGuest(data.name, {
        guestplayerid: userId,
      });
      console.log('✅ Guest added to room successfully:', {
        socketId: socket.id,
        roomId: joinedRoom.id,
        roomName: joinedRoom.name,
        guestId: data.userId,
      });

      // Si succès, rejoindre la room WebSocket
      await this.bindSocketToRoom(socket, joinedRoom, userId, 'guest');
      console.log('🔗 Socket joined room:', {
        socketId: socket.id,
        roomName: data.name,
      });

      console.log('👤 Guest rejoint la room:', {
        roomName: data.name,
        socketId: socket.id,
        userId: data.userId,
      });

      // Récupérer le username du joueur
      console.log('👤 Fetching user information for guest...');
      const user = await this.userService.findOne(parseInt(data.userId));
      const username = user ? user.username : `User-${data.userId}`;
      console.log('👤 User information retrieved:', {
        socketId: socket.id,
        userId: data.userId,
        username: username,
        userExists: !!user,
      });

      // Notifier les autres clients dans la room
      const guestJoinedData = {
        id: joinedRoom.id,
        userId: data.userId,
        username: username,
        socketId: socket.id,
      };
      console.log('📡 Emitting guest joined event:', {
        socketId: socket.id,
        roomName: data.name,
        guestData: guestJoinedData,
      });
      socket.to(data.name).emit('guest joined', guestJoinedData);

      // Récupérer l'identité de l'host
      console.log('👤 Fetching host information...', joinedRoom);
      const host = await this.userService.findOne(
        parseInt(joinedRoom.hostplayerid.toString()),
      );
      const hostName = host ? host.username : `User-${joinedRoom.hostplayerid}`;
      console.log('👤 Host information retrieved:', {
        socketId: socket.id,
        hostId: joinedRoom.hostplayerid,
        hostName: hostName,
        hostExists: !!host,
      });

      // Récupérer les images selon le mode de la room
      let images: any[];
      const roomMode = (joinedRoom as any).mode || 'category';

      if (roomMode === 'custom') {
        // Mode bibliothèque personnelle - récupérer les images du host
        const customLibraryUserId =
          (joinedRoom as any).custom_library_user_id || joinedRoom.hostplayerid;
        console.log(
          '📚 Mode custom: récupération bibliothèque user:',
          customLibraryUserId,
        );
        images = await this.imageService.findByUserId(customLibraryUserId);
        console.log('📸 Images bibliothèque récupérées:', {
          ownerId: customLibraryUserId,
          imageCount: images.length,
        });
      } else {
        // Mode catégorie
        console.log(
          '🖼️ Fetching images for room category:',
          joinedRoom.category,
        );
        images = await this.imageService.getUrlsByCategory(joinedRoom.category);
        console.log('📸 Images category retrieved:', {
          category: joinedRoom.category,
          imageCount: images.length,
        });
      }

      // Confirmer au client qui rejoint
      const hostJoinedData = {
        roomId: joinedRoom.id,
        roomName: data.name,
        hostId: joinedRoom.hostplayerid,
        hostName: hostName,
        category: joinedRoom.category,
        images: images,
        mode: roomMode,
      };
      console.log('📡 Emitting joined confirmation:', {
        socketId: socket.id,
        hostJoinedData: {
          ...hostJoinedData,
          images: `[${images.length} images]`,
        },
      });
      socket.emit('joined', hostJoinedData);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  @SubscribeMessage('start')
  async startGame(socket: Socket, data: any) {
    console.log('🚀 Event: start game', {
      socketId: socket.id,
      roomName: data?.name,
      timestamp: new Date().toISOString(),
    });

    try {
      if (!this.authorizeRoomEvent(socket, data?.name, undefined, 'host'))
        return;
      if (!data.name) {
        console.log('❌ Validation failed for start game:', {
          socketId: socket.id,
          missingFields: { name: !data.name },
        });
        socket.emit('error', { message: 'Room name is required' });
        return;
      }

      // Récupérer les informations de la room
      console.log('🔍 Looking for room:', data.name);
      const room = await this.roomService.findByName(data.name);
      if (!room) {
        console.log('⚠️ Room not found:', {
          socketId: socket.id,
          roomName: data.name,
        });
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (!room.guestplayerid) {
        this.emitError(
          socket,
          'ROOM_NOT_READY',
          'A guest must join before the game can start',
        );
        return;
      }
      if (room.status !== 'closed') {
        this.emitError(socket, 'INVALID_GAME_STATE', 'Game is not active');
        return;
      }
      console.log('✅ Room found:', {
        socketId: socket.id,
        roomId: room.id,
        roomName: room.name,
        category: room.category,
        mode: room.mode,
        deck_id: room.deck_id,
      });

      // Récupérer les images selon le mode
      let images: any[];

      if (room.mode === 'custom' && room.deck_id) {
        // Mode custom avec deck: récupérer les images du deck
        console.log('🖼️ Fetching images from deck:', room.deck_id);
        images = await this.imageService.getDeckImagesById(room.deck_id);
        console.log('📸 Deck images retrieved:', {
          deckId: room.deck_id,
          imageCount: images.length,
        });
      } else if (room.mode === 'custom' && room.custom_library_user_id) {
        // Mode custom legacy: récupérer toutes les images de l'utilisateur
        console.log(
          '🖼️ Fetching user library images:',
          room.custom_library_user_id,
        );
        images = await this.imageService.findByUserId(
          room.custom_library_user_id,
        );
        console.log('📸 User library images retrieved:', {
          userId: room.custom_library_user_id,
          imageCount: images.length,
        });
      } else {
        // Mode catégorie
        console.log('🖼️ Fetching images for category:', room.category);
        images = await this.imageService.getUrlsByCategory(room.category);
        console.log('📸 Category images retrieved:', {
          category: room.category,
          imageCount: images.length,
        });
      }

      if (images.length < 18) {
        console.log('❌ Not enough images:', { count: images.length });
        socket.emit('error', {
          message: "Pas assez d'images pour démarrer la partie (minimum 18)",
        });
        return;
      }

      // Envoyer les données avec la catégorie et les images
      const gameData = {
        roomName: data.name,
        category: room.category,
        images: images,
      };
      console.log('📡 Emitting game started event:', {
        socketId: socket.id,
        roomName: data.name,
        imageCount: images.length,
        mode: room.mode,
      });
      socket.to(data.name).emit('game started', gameData);
      socket.emit('game started', gameData);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: 'Failed to start game' });
    }
  }

  @SubscribeMessage('question')
  async askQuestion(socket: Socket, data: any) {
    console.log('❓ Event: ask question', {
      socketId: socket.id,
      roomName: data?.name,
      timestamp: new Date().toISOString(),
    });

    try {
      if (!this.authorizeRoomEvent(socket, data?.name, data?.player)) return;
      if (!this.validString(socket, data?.question, 'question', 500)) return;
      if (!data.name || !data.player || !data.question) {
        console.log('❌ Validation failed for ask question:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            question: !data.question,
          },
        });
        socket.emit('error', {
          message: 'Missing required data: name and question are required',
        });
        return;
      }

      console.log('📡 Emitting ask question event:', {
        socketId: socket.id,
        roomName: data.name,
        player: data.player,
      });
      socket.to(data.name).emit('ask', {
        question: data.question,
        player: data.player,
        name: data.name,
      });
      socket.emit('ask', {
        question: data.question,
        player: data.player,
        name: data.name,
      });
    } catch (error) {
      console.error('Error asking question:', error);
      socket.emit('error', { message: 'Failed to ask question' });
    }
  }

  @SubscribeMessage('answer')
  async answerQuestion(socket: Socket, data: any) {
    console.log('💬 Event: answer question', {
      socketId: socket.id,
      roomName: data?.name,
      timestamp: new Date().toISOString(),
    });

    try {
      if (!this.authorizeRoomEvent(socket, data?.name, data?.player)) return;
      if (!this.validString(socket, data?.answer, 'answer', 100)) return;
      if (!data.name || !data.answer || !data.player) {
        console.log('❌ Validation failed for answer question:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            answer: !data.answer,
          },
        });
        socket.emit('error', {
          message: 'Missing required data: name and answer are required',
        });
        return;
      }

      console.log('📡 Emitting answer event:', {
        socketId: socket.id,
        roomName: data.name,
      });
      socket.to(data.name).emit('answer', {
        answer: data.answer,
        player: data.player,
        name: data.name,
      });
      socket.emit('answer', {
        answer: data.answer,
        player: data.player,
        name: data.name,
      });
    } catch (error) {
      console.error('Error answering question:', error);
      socket.emit('error', { message: 'Failed to answer question' });
    }
  }

  @SubscribeMessage('choose')
  async chooseCharacter(socket: Socket, data: any) {
    console.log('🎭 Event: choose character', {
      socketId: socket.id,
      roomName: data?.name,
      timestamp: new Date().toISOString(),
    });

    try {
      if (!this.authorizeRoomEvent(socket, data?.name, data?.player)) return;
      if (!this.validPositiveInteger(socket, data?.characterId, 'characterId'))
        return;
      if (!data.name || !data.player || !data.characterId) {
        console.log('❌ Validation failed for choose character:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            player: !data.player,
            characterId: !data.characterId,
          },
        });
        socket.emit('error', {
          message:
            'Missing required data: name, player, and characterId are required',
        });
        return;
      }

      console.log('📝 Saving character choice in database...');
      await this.roomService.chooseCharacter(
        data.name,
        data.player,
        data.characterId,
      );
      console.log('✅ Character choice saved:', {
        socketId: socket.id,
        roomName: data.name,
        player: data.player,
        characterId: data.characterId,
      });

      // Vérifier si les deux joueurs ont choisi leurs personnages
      console.log(
        '🔍 Checking if both players have chosen their characters...',
      );
      const room = await this.roomService.findByName(data.name);
      const bothPlayersChosen = room.hostcharacterid && room.guestcharacterid;

      console.log('🎭 Character selection status:', {
        socketId: socket.id,
        roomName: data.name,
        hostCharacterId: room.hostcharacterid,
        guestCharacterId: room.guestcharacterid,
        bothPlayersChosen: bothPlayersChosen,
      });

      if (bothPlayersChosen) {
        await this.atelierGame?.started(data.name);
        console.log('🎯 Both players have chosen - starting game board!');
        const goBoardData = { turn: 'host' };
        console.log('📡 Emitting go board event:', {
          socketId: socket.id,
          roomName: data.name,
          goBoardData: goBoardData,
        });
        socket.to(data.name).emit('go board', goBoardData);
        socket.emit('go board', goBoardData);
      } else {
        console.log('⏳ Waiting for other player to choose character...');
        console.log('📡 Emitting character choice events:', {
          socketId: socket.id,
          roomName: data.name,
          player: data.player,
          characterId: data.characterId,
        });
        socket.to(data.name).emit('character chosen', {
          player: data.player,
        });
        socket.emit('character chosen', {
          player: data.player,
          characterId: data.characterId,
        });
      }
    } catch (error) {
      console.error('Error choosing character:', error);
      socket.emit('error', { message: 'Failed to choose character' });
    }
  }

  @SubscribeMessage('change turn')
  async changeTurn(socket: Socket, data: any) {
    console.log('🔄 Event: change turn', {
      socketId: socket.id,
      roomName: data?.name,
      timestamp: new Date().toISOString(),
    });

    try {
      if (!this.authorizeRoomEvent(socket, data?.name, data?.player)) return;
      if (!data.name || !data.player) {
        console.log('❌ Validation failed for change turn:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            player: !data.player,
          },
        });
        socket.emit('error', {
          message: 'Missing required data: name and player are required',
        });
        return;
      }

      console.log('📡 Emitting turn change events:', {
        socketId: socket.id,
        roomName: data.name,
        player: data.player,
      });
      socket.to(data.name).emit('start turn', { turn: data.player });
      socket.emit('start turn', { turn: data.player });
    } catch (error) {
      socket.emit('error', { message: 'Failed to change turn' });
    }
  }

  @SubscribeMessage('select')
  async selectCharacter(socket: Socket, data: any) {
    if (this.atelierGame?.enabled) {
      if (!this.authorizeRoomEvent(socket, data?.name, data?.player)) return;
      if (!this.validPositiveInteger(socket, data?.characterId, 'characterId')) return;
      try {
        const result = await this.atelierGame.guess(data.name, Number(socket.data.authenticatedUserId), data.player, data.characterId);
        socket.emit('select result', result);
        if (!result.duplicate) socket.to(data.name).emit('select result', result);
      } catch (error) {
        const response = typeof error.getResponse === 'function' ? error.getResponse() : null;
        this.emitError(socket, response?.code || 'GUESS_FAILED', response?.message || 'Impossible de valider la tentative.');
      }
      return;
    }
    console.log('🎯 Event: select character', {
      socketId: socket.id,
      roomName: data?.name,
      timestamp: new Date().toISOString(),
    });

    try {
      if (!this.authorizeRoomEvent(socket, data?.name, data?.player)) return;
      if (!data.name || !data.player || !data.characterId) {
        console.log('❌ Validation failed for select character:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            player: !data.player,
            characterId: !data.characterId,
          },
        });
        socket.emit('error', {
          message:
            'Missing required data: name, player, and characterId are required',
        });
        return;
      }

      console.log('🔍 Checking character selection result...');
      const character = await this.roomService.selectCharacter(
        data.name,
        data.player,
        data.characterId,
      );

      const gameResult = character ? 'won' : 'lost';
      console.log('🏆 Game result determined:', {
        socketId: socket.id,
        roomName: data.name,
        player: data.player,
        characterId: data.characterId,
        result: gameResult,
        isCorrect: character,
      });

      const eventName = `${data.player} ${gameResult}`;
      console.log('📡 Emitting game result events:', {
        socketId: socket.id,
        roomName: data.name,
        eventName: eventName,
      });

      if (character) {
        const firstCompletion = await this.roomService.finishGame(data.name);
        if (!firstCompletion) {
          this.emitError(
            socket,
            'GAME_ALREADY_FINISHED',
            'This game result was already recorded',
          );
          return;
        }

        // Récupérer les character IDs de la room
        const room = await this.roomService.findByName(data.name);
        const hostCharacterId = room?.hostcharacterid;
        const guestCharacterId = room?.guestcharacterid;

        console.log('🎭 Character IDs récupérés:', {
          socketId: socket.id,
          roomName: data.name,
          hostCharacterId,
          guestCharacterId,
        });

        // Mettre à jour le score du joueur gagnant (+8 points)
        const winnerUserId =
          data.player === 'host' ? room.hostplayerid : room.guestplayerid;

        console.log('👤 [selectCharacter] Détermination du gagnant:', {
          socketId: socket.id,
          roomName: data.name,
          player: data.player,
          winnerUserId: winnerUserId,
          hostPlayerId: room.hostplayerid,
          guestPlayerId: room.guestplayerid,
        });

        if (winnerUserId) {
          console.log(
            "🔍 [selectCharacter] Recherche de l'utilisateur gagnant:",
            {
              socketId: socket.id,
              winnerUserId: winnerUserId,
            },
          );

          const winnerUser = await this.userService.findOne(winnerUserId);

          console.log('👤 [selectCharacter] Utilisateur gagnant trouvé:', {
            socketId: socket.id,
            winnerUserId: winnerUserId,
            userFound: !!winnerUser,
            currentScore: winnerUser?.score,
          });

          if (winnerUser) {
            const newScore = winnerUser.score + 8;
            console.log('💰 [selectCharacter] Calcul du nouveau score:', {
              socketId: socket.id,
              userId: winnerUserId,
              player: data.player,
              oldScore: winnerUser.score,
              newScore: newScore,
              pointsToAdd: 8,
            });

            try {
              await this.userService.incrementScore(winnerUserId, 8);
              console.log(
                '✅ [selectCharacter] Score mis à jour avec succès:',
                {
                  socketId: socket.id,
                  userId: winnerUserId,
                  player: data.player,
                  oldScore: winnerUser.score,
                  newScore: newScore,
                },
              );
            } catch (error) {
              console.error(
                '❌ [selectCharacter] Erreur lors de la mise à jour du score:',
                {
                  socketId: socket.id,
                  userId: winnerUserId,
                  player: data.player,
                  error: error.message,
                  errorStack: error.stack,
                },
              );
              throw error;
            }
          } else {
            console.warn(
              '⚠️ [selectCharacter] Utilisateur gagnant non trouvé:',
              {
                socketId: socket.id,
                winnerUserId: winnerUserId,
                player: data.player,
              },
            );
          }
        } else {
          console.warn(
            '⚠️ [selectCharacter] winnerUserId est null ou undefined:',
            {
              socketId: socket.id,
              player: data.player,
              hostPlayerId: room.hostplayerid,
              guestPlayerId: room.guestplayerid,
            },
          );
        }

        // Émettre les événements de victoire/défaite
        console.log(
          '📡 [selectCharacter] Émission des événements de victoire:',
          {
            socketId: socket.id,
            roomName: data.name,
            eventName: eventName,
            player: data.player,
          },
        );

        socket.emit(eventName, {
          player: data.player,
          roomName: data.name,
        });

        socket.to(data.name).emit(eventName, {
          player: data.player,
          roomName: data.name,
        });

        console.log(
          '✅ [selectCharacter] Événements de victoire émis avec succès:',
          {
            socketId: socket.id,
            roomName: data.name,
            eventName: eventName,
            emittedToSelf: true,
            emittedToRoom: true,
          },
        );

        socket.emit('select result', {
          player: data.player,
          right: true,
          hostCharacterId,
          guestCharacterId,
        });
        socket.to(data.name).emit('select result', {
          player: data.player,
          right: true,
          hostCharacterId,
          guestCharacterId,
        });
      } else {
        // Émettre les événements de victoire/défaite même en cas de perte
        console.log(
          '📡 [selectCharacter] Émission des événements de défaite:',
          {
            socketId: socket.id,
            roomName: data.name,
            eventName: eventName,
            player: data.player,
          },
        );

        socket.emit(eventName, {
          player: data.player,
          roomName: data.name,
        });

        socket.to(data.name).emit(eventName, {
          player: data.player,
          roomName: data.name,
        });

        console.log(
          '✅ [selectCharacter] Événements de défaite émis avec succès:',
          {
            socketId: socket.id,
            roomName: data.name,
            eventName: eventName,
          },
        );

        socket.emit('select result', { player: data.player, right: false });
        socket
          .to(data.name)
          .emit('select result', { player: data.player, right: false });
      }
    } catch (error) {
      console.error('Error selecting character', error);
      socket.emit('error', { message: 'Failed to select character' });
    }
  }

  @SubscribeMessage('lost lifes')
  async playerLostLifes(socket: Socket, data: any) {
    if (this.atelierGame?.enabled) {
      // Client self-reports can no longer finish a match or mint rewards.
      this.emitError(socket, 'SERVER_LIVES', 'Les vies sont vérifiées par le serveur.');
      return;
    }
    try {
      if (!this.authorizeRoomEvent(socket, data?.name, data?.player)) return;
      if (!data.name || !data.player) {
        console.log('❌ Validation failed for lost lifes:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            player: !data.player,
          },
        });
        socket.emit('error', {
          message: 'Missing required data: name and player are required',
        });
        return;
      }

      // Récupérer la room et attribuer +8 points au gagnant
      const room = await this.roomService.findByName(data.name);
      if (!room) {
        this.emitError(socket, 'ROOM_NOT_FOUND', 'Room not found');
        return;
      }

      const firstCompletion = await this.roomService.finishGame(data.name);
      if (!firstCompletion) {
        this.emitError(
          socket,
          'GAME_ALREADY_FINISHED',
          'This game result was already recorded',
        );
        return;
      }

      // Déterminer qui est le gagnant (l'autre joueur)
      const winnerUserId =
        data.player === 'host' ? room.guestplayerid : room.hostplayerid;

      if (winnerUserId) {
        const winnerUser = await this.userService.findOne(winnerUserId);
        if (winnerUser) {
          // Incrémenter le score de 8 points
          const newScore = winnerUser.score + 8;
          await this.userService.incrementScore(winnerUserId, 8);

          console.log('🎯 Score mis à jour après perte de vies:', {
            loser: data.player,
            winnerId: winnerUserId,
            oldScore: winnerUser.score,
            newScore: newScore,
            pointsGained: 8,
          });
        }
      }

      socket.emit('player lost all lifes', { player: data.player });
      socket
        .to(data.name)
        .emit('player lost all lifes', { player: data.player });
    } catch (error) {
      console.error('Error losing lifes', error);
      socket.emit('error', { message: 'Failed to lose lifes' });
    }
  }

  @SubscribeMessage('ask rematch')
  async askRematch(socket: Socket, data: any) {
    try {
      if (!this.authorizeRoomEvent(socket, data?.name, data?.player)) return;
      if (!data.name || !data.player) {
        console.log('❌ Validation failed for ask rematch:', {
          socketId: socket.id,
          missingFields: {
            name: !data.name,
            player: !data.player,
          },
        });
        socket.emit('error', {
          message: 'Missing required data: name and player are required',
        });
        return;
      }

      console.log('🔄 Event: ask rematch', {
        socketId: socket.id,
        roomName: data?.name,
        timestamp: new Date().toISOString(),
      });

      const roomName = data.name;
      const player = data.player;

      // Récupérer tous les sockets de la room
      const roomSockets = await this.wss.in(roomName).fetchSockets();
      console.log('🔍 Room sockets for rematch:', roomSockets.length);

      // Trouver le socket actuel et l'autre socket
      const currentSocket = roomSockets.find((s) => s.id === socket.id);
      const otherSockets = roomSockets.filter((s) => s.id !== socket.id);

      // Vérifier si l'autre joueur a déjà demandé un rematch
      const otherSocket = otherSockets[0]; // Prendre le premier autre socket
      const hasOtherRequested = otherSocket?.data?.playAgainRequested;

      if (hasOtherRequested) {
        // L'autre joueur a déjà demandé, on peut procéder
        console.log('✅ Les deux joueurs veulent rejouer');

        // Nettoyer les flags
        if (currentSocket) currentSocket.data.playAgainRequested = false;
        if (otherSocket) otherSocket.data.playAgainRequested = false;

        // Émettre l'événement final
        socket.to(roomName).emit('rematch can start', { event: 'play_again' });
        socket.emit('rematch can start', { event: 'play_again' });
      } else {
        // Marquer que ce joueur attend
        if (currentSocket) currentSocket.data.playAgainRequested = true;

        console.log(`⏳ Joueur ${player} attend la réponse de l'autre`);
        socket.to(roomName).emit('ask play again', { player });
        socket.emit('ask play again', { player });
      }
    } catch (error) {
      console.error('Error asking rematch', error);
      socket.emit('error', { message: 'Failed to ask rematch' });
    }
  }

  @SubscribeMessage('rematch')
  async rematch(socket: Socket, data: any) {
    console.log('🔄 Event: rematch', {
      socketId: socket.id,
      roomName: data?.oldRoomName,
      timestamp: new Date().toISOString(),
    });

    try {
      const previousSession = this.authorizeRoomEvent(
        socket,
        data?.oldRoomName,
        undefined,
        'host',
      );
      const userId = this.authenticatedUserId(socket, data?.hostId);
      if (
        !previousSession ||
        !userId ||
        !this.validRoomName(socket, data?.newRoomName) ||
        !this.validString(socket, data?.category, 'category', 50)
      ) {
        return;
      }

      const newRoom = await this.createRoomWithHost(
        data.newRoomName,
        userId,
        data.category,
      );

      // The invitation must be emitted while the host is still in the old room.
      socket.to(previousSession.roomName).emit('rematch invitation', {
        newRoomName: data.newRoomName,
        category: data.category,
        hostId: userId,
        roomId: newRoom.id,
      });

      await this.bindSocketToRoom(socket, newRoom, userId, 'host');
      await this.notifyRoomCreation(socket, newRoom, userId);

      console.log('✅ Rematch room created successfully:', {
        newRoomName: data.newRoomName,
        category: data.category,
        hostId: data.hostId,
      });
    } catch (error) {
      console.error('Error creating rematch room:', error);
      socket.emit('error', { message: 'Failed to create rematch room' });
    }
  }

  @SubscribeMessage('join rematch')
  async joinRematch(socket: Socket, data: any) {
    console.log('🔄 Event: join rematch', {
      socketId: socket.id,
      roomName: data?.newRoomName,
      timestamp: new Date().toISOString(),
    });

    try {
      const previousSession = socket.data.roomSession as
        | RoomSocketSession
        | undefined;
      const userId = this.authenticatedUserId(socket, data?.guestId);
      if (!userId || !this.validRoomName(socket, data?.newRoomName)) return;
      if (!previousSession || previousSession.role !== 'guest') {
        this.emitError(
          socket,
          'FORBIDDEN',
          'Only the guest from the previous game can join a rematch',
        );
        return;
      }

      const joinedRoom = await this.addGuestToRoom(data.newRoomName, userId);
      await this.bindSocketToRoom(socket, joinedRoom, userId, 'guest');
      await this.notifyGuestJoined(socket, joinedRoom);

      // Both players have moved: the previous game no longer needs persistence.
      const previousRoom = await this.roomService.findByName(
        previousSession.roomName,
      );
      if (previousRoom?.id === previousSession.roomId) {
        await this.roomImageService.removeRoomImage(previousRoom.id);
        await this.roomService.remove(previousRoom.id);
      }

      console.log('✅ Guest joined rematch room successfully:', {
        newRoomName: data.newRoomName,
        guestId: data.guestId,
      });
    } catch (error) {
      console.error('Error joining rematch room:', error);
      socket.emit('error', { message: 'Failed to join rematch room' });
    }
  }

  @SubscribeMessage('resume')
  async resumeRoom(socket: Socket, data: any) {
    try {
      const userId = this.authenticatedUserId(socket);
      if (!userId || !this.validRoomName(socket, data?.name)) return;

      const room = await this.roomService.findByName(data.name);
      if (!room) {
        this.emitError(
          socket,
          'ROOM_NOT_FOUND',
          'Room not found or already closed',
        );
        return;
      }

      const role: PlayerRole | null =
        room.hostplayerid === userId
          ? 'host'
          : room.guestplayerid === userId
          ? 'guest'
          : null;
      if (!role) {
        this.emitError(
          socket,
          'FORBIDDEN',
          'Authenticated user is not a player in this room',
        );
        return;
      }

      const activeSockets = await this.wss.in(room.name).fetchSockets();
      const alreadyConnected = activeSockets.some((candidate) => {
        if (candidate.id === socket.id) return false;
        const activeSession = candidate.data.roomSession as
          | RoomSocketSession
          | undefined;
        return (
          activeSession?.roomId === room.id &&
          activeSession.userId === userId &&
          activeSession.role === role
        );
      });
      if (alreadyConnected) {
        this.emitError(
          socket,
          'ALREADY_CONNECTED',
          'This player already has an active socket in the room',
        );
        return;
      }

      await this.bindSocketToRoom(socket, room, userId, role);
      socket.emit('room resumed', {
        ...(this.atelierGame?.enabled ? await this.atelierGame.state(room.name) : {}),
        roomId: room.id,
        roomName: room.name,
        role,
        status: room.status,
        hostCharacterChosen: room.hostcharacterid !== null,
        guestCharacterChosen: room.guestcharacterid !== null,
      });
      socket.to(room.name).emit('player reconnected', { userId, role });
    } catch (error) {
      this.logger.error(
        'Failed to resume room',
        error instanceof Error ? error.stack : String(error),
      );
      this.emitError(socket, 'RESUME_FAILED', 'Failed to resume room');
    }
  }

  @SubscribeMessage('quit')
  async quitRoom(socket: Socket, data: any) {
    console.log('🚫 Event: quit room', {
      socketId: socket.id,
      roomName: data?.name,
      timestamp: new Date().toISOString(),
    });

    try {
      const userId = this.authenticatedUserId(socket, data?.userId);
      const session = this.authorizeRoomEvent(socket, data?.name);
      if (!userId || !session) return;
      if (data?.id !== undefined && Number(data.id) !== session.roomId) {
        this.emitError(
          socket,
          'FORBIDDEN',
          'Room ID does not match this socket session',
        );
        return;
      }

      const room = await this.roomService.findByName(session.roomName);
      if (!room || room.id !== session.roomId) {
        this.emitError(socket, 'ROOM_NOT_FOUND', 'Room not found');
        return;
      }

      delete socket.data.roomSession;
      this.clearPendingDisconnect(this.sessionKey(session));
      const gameStarted = !!(room.hostcharacterid || room.guestcharacterid);

      if (session.role === 'guest' && !gameStarted) {
        const reopened = await this.roomService.reopenRoomAfterGuestLeaves(
          room.name,
          session.userId,
        );
        if (reopened) {
          socket.to(room.name).emit('guestLeftBeforeStart', {
            roomId: room.id,
            roomName: room.name,
          });
        }
      } else {
        socket.to(room.name).emit('quit', { player: userId });
        await this.roomImageService.removeRoomImage(room.id);
        await this.roomService.remove(room.id);
      }

      socket.emit('room left', { roomId: room.id });
      await socket.leave(room.name);
    } catch (error) {
      console.error('Error quitting room:', error);
      socket.emit('error', { message: 'Failed to quit room' });
    }
  }
}
