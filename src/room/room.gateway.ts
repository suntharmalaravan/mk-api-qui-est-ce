import { SocialService } from '../social/social.service';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import {
  ForbiddenException,
  Logger,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { AtelierGameService } from '../atelier/atelier-game.service';
import { Socket, Server } from 'socket.io';
import { RoomService } from './room.service';
import { LobbyService } from './lobby.service';
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

interface RematchState {
  roomId: number;
  roomName: string;
  hostId: number;
  guestId: number;
  requested: Set<PlayerRole>;
  phase: 'waiting' | 'ready' | 'starting';
  target?: {
    id: number;
    name: string;
    category: string;
    mode?: string;
    deck_id?: number | null;
  };
  joining?: boolean;
  hostReady?: boolean;
}

interface SocketData {
  authenticatedUserId?: number;
  roomSession?: RoomSocketSession;
  playAgainRequested?: boolean;
}

const ROOM_NAME_PATTERN = /^[a-zA-Z0-9_-]{3,30}$/;

/** A turn lasts 60 s, like the client countdown. */
const TURN_DURATION_MS = 60_000;
/**
 * Extra time the player holding the turn keeps before the opponent may take
 * it (client TURN_STALL_GRACE_SECONDS): JS timers freeze in background.
 */
const TURN_STALL_GRACE_MS = 8_000;

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
  // Room state belongs to the gateway, never to fetchSockets() data copies.
  // Like turns and the Socket.IO adapter, this session state is single-instance.
  private readonly rematches = new Map<string, RematchState>();
  private readonly pendingDisconnects = new Map<string, NodeJS.Timeout>();
  /**
   * Whose turn it is, per room. Kept in memory like the Socket.IO adapter,
   * hence the single-instance constraint documented in SOCKET_AUDIT.md.
   */
  private readonly turns = new Map<
    string,
    { turn: PlayerRole; since: number }
  >();
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
    @Optional() private readonly lobby?: LobbyService,
    @Optional() private readonly social?: SocialService,
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

    // The opponent learns at once that this player is offline; the room is
    // only closed, with `playerDisconnected`, when the grace period expires.
    this.wss.to(session.roomName).emit('player connection lost', {
      userId: session.userId,
      role: session.role,
      graceMs: this.disconnectGraceMs,
    });

    this.logger.log(
      `Socket ${client.id} disconnected; keeping ${session.roomName}/${session.role} for ${this.disconnectGraceMs}ms`,
    );
  }

  onModuleDestroy() {
    for (const timer of this.pendingDisconnects.values()) clearTimeout(timer);
    this.pendingDisconnects.clear();
    this.turns.clear();
    this.rematches.clear();
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

  /** Acknowledgement payload of a refused request. */
  private ackError(code: string, message: string) {
    return { error: { code, message } };
  }

  /**
   * A refused lobby request. Business refusals keep their message and code;
   * anything else is logged and replaced by the fallback, so a database
   * error never reaches the player's screen.
   */
  private lobbyError(error: any, fallback: string) {
    const response =
      typeof error?.getResponse === 'function' ? error.getResponse() : null;
    if (!response) {
      this.logger.error(
        `Lobby request failed: ${fallback}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
    return {
      error: {
        code:
          response && typeof response === 'object' && response.code
            ? response.code
            : undefined,
        message: response ? error.message : fallback,
      },
    };
  }

  private other(role: PlayerRole): PlayerRole {
    return role === 'host' ? 'guest' : 'host';
  }

  /** Records whose turn it is and tells both players. */
  private announceTurn(roomName: string, turn: PlayerRole) {
    this.turns.set(roomName, { turn, since: Date.now() });
    this.wss.to(roomName).emit('start turn', { turn });
  }

  /**
   * Questions and guesses belong to the player holding the turn. An unknown
   * state — server restarted mid-game — stays permissive rather than locking
   * both players out.
   */
  private holdsTurn(
    socket: Socket,
    session: RoomSocketSession,
    action: 'question' | 'select',
  ) {
    const state = this.turns.get(session.roomName);
    if (!state || state.turn === session.role) return true;
    socket.emit('error', {
      code: 'NOT_YOUR_TURN',
      action,
      message: 'Ce n’est plus ton tour.',
    });
    return false;
  }

  /** A wrong guess hands the turn over; a winning or final one ends the game. */
  private afterGuess(
    session: RoomSocketSession,
    right: boolean,
    terminal: boolean,
  ) {
    if (right || terminal) {
      this.turns.delete(session.roomName);
      return;
    }
    this.announceTurn(session.roomName, this.other(session.role));
  }

  /**
   * Detaches every socket still bound to a room that is being closed, and
   * forgets its game state.
   *
   * Without this the remaining player kept a session on a deleted room: each
   * later `create` or `join` was refused with ALREADY_IN_ROOM until the app
   * reconnected.
   */
  private async detachRoomSockets(room: { id: number; name: string }) {
    this.turns.delete(room.name);
    const related = [...this.rematches.values()].filter(
      (state) =>
        state.roomName === room.name || state.target?.name === room.name,
    );
    for (const state of related) this.rematches.delete(state.roomName);
    // A player can quit while the other is still in the previous room.
    // Close both sides of that transition; otherwise one player waits forever.
    for (const state of related) {
      const otherName =
        state.roomName === room.name ? state.target?.name : state.roomName;
      if (!otherName) continue;
      const otherRoom = await this.roomService.findByName(otherName);
      if (!otherRoom) continue;
      this.wss.to(otherName).emit('quit', { player: 0 });
      await this.detachRoomSockets(otherRoom);
      await this.roomImageService.removeRoomImage(otherRoom.id);
      await this.roomService.remove(otherRoom.id);
    }
    const sockets = await this.wss.in(room.name).fetchSockets();
    for (const candidate of sockets) {
      if (candidate.data.roomSession?.roomId === room.id) {
        delete candidate.data.roomSession;
        candidate.data.playAgainRequested = false;
      }
      candidate.leave(room.name);
    }
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
      this.clearPendingDisconnect(this.sessionKey(previous));
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
        !!room.selection_started_at ||
        room.hostcharacterid !== null ||
        room.guestcharacterid !== null;

      if (session.role === 'guest' && !gameStarted) {
        const reopened = await this.roomService.reopenRoomAfterGuestLeaves(
          room.name,
          session.userId,
        );
        if (reopened) {
          this.releaseRematchReservation(room.name);
          this.wss.to(room.name).emit('guestLeftBeforeStart', {
            roomId: room.id,
            roomName: room.name,
          });
          return;
        }
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
      await this.detachRoomSockets(room);
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
    const invitation = [...this.rematches.values()].find(
      (state) => state.target?.name === roomName,
    );
    if (invitation && invitation.guestId !== userId)
      throw new ForbiddenException(
        'Cette revanche est réservée à l’adversaire invité.',
      );
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
        if (!(await this.imageService.isCategoryVisible(data.category))) {
          socket.emit('error', {
            message: `La catégorie "${data.category}" n'est plus disponible`,
          });
          return;
        }
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
      if (
        data.invitationId !== undefined &&
        (typeof data.invitationId !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            data.invitationId,
          ))
      ) {
        this.emitError(socket, 'INVALID_INVITATION', 'Invitation invalide.');
        return;
      }
      if (data.invitationId && !this.social) {
        this.emitError(
          socket,
          'SOCIAL_UNAVAILABLE',
          'Les invitations sont indisponibles.',
        );
        return;
      }
      const joinedRoom = data.invitationId
        ? await this.social.acceptInvitation(
            userId,
            data.invitationId,
            data.name,
          )
        : await this.roomService.addGuest(data.name, { guestplayerid: userId });
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
      socket.emit('error', {
        message:
          data?.invitationId && error.getStatus
            ? error.message
            : 'Failed to join room',
      });
    }
  }

  @SubscribeMessage('get lobby')
  async getLobby(socket: Socket, data: any) {
    const session = this.authorizeRoomEvent(socket, data?.name);
    if (!session || !this.lobby)
      return { error: { message: 'Salon indisponible.' } };
    try {
      return await this.lobby.snapshot(data.name, session.userId);
    } catch (e) {
      return this.lobbyError(e, 'Salon indisponible.');
    }
  }
  @SubscribeMessage('change lobby theme')
  async changeLobbyTheme(socket: Socket, data: any) {
    const session = this.authorizeRoomEvent(
      socket,
      data?.name,
      undefined,
      'host',
    );
    if (!session || !this.lobby)
      return { error: { message: 'Seul l’hôte peut changer le thème.' } };
    try {
      const settings = await this.lobby.change(
        data.name,
        session.userId,
        data,
        data.revision,
      );
      this.wss.to(data.name).emit('lobby theme changed', settings);
      return settings;
    } catch (e) {
      return this.lobbyError(e, 'Thème indisponible.');
    }
  }
  @SubscribeMessage('start')
  async startGame(socket: Socket, data: any) {
    const session = this.authorizeRoomEvent(
      socket,
      data?.name,
      undefined,
      'host',
    );
    if (!session) return;
    try {
      if (!this.lobby) throw new Error('Salon indisponible.');
      const game = await this.lobby.start(
        data.name,
        session.userId,
        data.revision,
      );
      this.wss.to(data.name).emit('game started', game);
    } catch (error) {
      this.emitError(
        socket,
        'START_FAILED',
        error instanceof Error
          ? error.message
          : 'Impossible de lancer la partie.',
      );
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
      const session = this.authorizeRoomEvent(socket, data?.name, data?.player);
      if (!session || !this.holdsTurn(socket, session, 'question')) return;
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

  /**
   * Records a secret character and acknowledges the outcome.
   *
   * Clients used to switch to "waiting for opponent" before any answer: a
   * refused choice was only reported on the generic `error` event, which the
   * selection screen does not listen to, so both players waited for a
   * `go board` that never came.
   */
  @SubscribeMessage('choose')
  async chooseCharacter(socket: Socket, data: any) {
    const session = this.authorizeRoomEvent(socket, data?.name, data?.player);
    if (!session) {
      return this.ackError(
        'FORBIDDEN',
        'Tu ne fais plus partie de cette partie.',
      );
    }
    if (!this.validPositiveInteger(socket, data?.characterId, 'characterId')) {
      return this.ackError('INVALID_PAYLOAD', 'Personnage invalide.');
    }
    const characterId = Number(data.characterId);

    try {
      const room = await this.roomService.chooseCharacter(
        session.roomName,
        session.role,
        characterId,
      );
      const bothChosen =
        room.hostcharacterid !== null && room.guestcharacterid !== null;

      if (bothChosen) {
        await this.atelierGame?.started(session.roomName);
        // When both players confirm at the same instant, both requests can
        // observe the completed pair: clients treat `go board` as idempotent.
        this.wss.to(session.roomName).emit('go board', { turn: 'host' });
        // Announced now, not left to a client fallback. A repeated choice
        // must never reset a game already under way.
        if (!this.turns.has(session.roomName)) {
          this.announceTurn(session.roomName, 'host');
        }
      } else {
        // Only the chooser learns which character was recorded.
        socket
          .to(session.roomName)
          .emit('character chosen', { player: session.role });
        socket.emit('character chosen', { player: session.role, characterId });
      }
      return { ok: true, bothChosen };
    } catch (error) {
      const response =
        typeof error?.getResponse === 'function' ? error.getResponse() : null;
      const code = response?.code || 'CHOOSE_FAILED';
      const message =
        response?.code && response?.message
          ? response.message
          : 'Impossible d’enregistrer ton personnage.';
      this.logger.warn(
        `choose refused in ${session.roomName}/${session.role}: ${code}`,
      );
      this.emitError(socket, code, message);
      return this.ackError(code, message);
    }
  }

  /**
   * Hands the turn over.
   *
   * `pass` — the player holding the turn ends it (button or expired timer).
   * `claim` — the waiting player takes a turn its holder never handed back
   * (app frozen in background); accepted only once that turn has overrun.
   *
   * Both are idempotent: a double tap, or a timer racing the button, cannot
   * flip the turn twice. `player` is always the sender's own role — clients
   * used to send the next player's role, which the role guard refused, so
   * "Passer" did nothing. The acknowledgement carries the authoritative turn.
   */
  @SubscribeMessage('change turn')
  changeTurn(socket: Socket, data: any) {
    const session = this.authorizeRoomEvent(socket, data?.name, data?.player);
    if (!session) {
      return this.ackError(
        'FORBIDDEN',
        'Tu ne fais plus partie de cette partie.',
      );
    }

    const mine = session.role;
    const state = this.turns.get(session.roomName);
    if (data?.intent === 'pass') {
      if (!state || state.turn === mine) {
        this.announceTurn(session.roomName, this.other(mine));
      }
    } else if (
      !state ||
      (state.turn !== mine &&
        Date.now() - state.since >= TURN_DURATION_MS + TURN_STALL_GRACE_MS)
    ) {
      this.announceTurn(session.roomName, mine);
    }

    return { turn: this.turns.get(session.roomName)?.turn ?? null };
  }

  @SubscribeMessage('select')
  async selectCharacter(socket: Socket, data: any) {
    if (this.atelierGame?.enabled) {
      const session = this.authorizeRoomEvent(socket, data?.name, data?.player);
      if (!session || !this.holdsTurn(socket, session, 'select')) return;
      if (!this.validPositiveInteger(socket, data?.characterId, 'characterId'))
        return;
      try {
        const result = await this.atelierGame.guess(
          session.roomName,
          session.userId,
          session.role,
          Number(data.characterId),
        );
        socket.emit('select result', result);
        if (!result.duplicate) {
          socket.to(session.roomName).emit('select result', result);
          this.afterGuess(session, result.right, result.terminal);
        }
      } catch (error) {
        const response =
          typeof error.getResponse === 'function' ? error.getResponse() : null;
        this.emitError(
          socket,
          response?.code || 'GUESS_FAILED',
          response?.message || 'Impossible de valider la tentative.',
        );
      }
      return;
    }
    console.log('🎯 Event: select character', {
      socketId: socket.id,
      roomName: data?.name,
      timestamp: new Date().toISOString(),
    });

    try {
      const session = this.authorizeRoomEvent(socket, data?.name, data?.player);
      if (!session || !this.holdsTurn(socket, session, 'select')) return;
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
        this.afterGuess(session, true, true);
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
        // Legacy mode does not count lives server-side: the client ends the
        // game on its last one, and ignores this turn once the game is over.
        this.afterGuess(session, false, false);
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
      this.emitError(
        socket,
        'SERVER_LIVES',
        'Les vies sont vérifiées par le serveur.',
      );
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

  private releaseRematchReservation(roomName: string) {
    for (const [name, state] of this.rematches) {
      if (state.target?.name === roomName) this.rematches.delete(name);
    }
  }

  private rematchSnapshot(state: RematchState) {
    return {
      roomName: state.roomName,
      requested: [...state.requested],
      phase: state.phase,
    };
  }

  private publishRematch(state: RematchState) {
    this.wss
      .to(state.roomName)
      .emit('rematch state', this.rematchSnapshot(state));
  }

  private rematchInvitation(state: RematchState) {
    const room = state.target;
    return {
      oldRoomName: state.roomName,
      newRoomName: room.name,
      roomId: room.id,
      hostId: state.hostId,
      category: room.category,
      mode: room.mode,
      deckId: room.deck_id,
    };
  }

  @SubscribeMessage('rematch status')
  async rematchStatus(socket: Socket, data: any) {
    const session = this.authorizeRoomEvent(socket, data?.name);
    if (!session) return;
    const state = this.rematches.get(session.roomName);
    if (!state) {
      socket.emit('rematch state', {
        roomName: session.roomName,
        requested: [],
        phase: 'waiting',
      });
      return;
    }
    socket.emit('rematch state', this.rematchSnapshot(state));
    // Recover notifications missed while mounting the result screen or reconnecting.
    if (state.phase === 'ready' || (state.target && session.role === 'host'))
      socket.emit('rematch can start', { roomName: state.roomName });
    if (state.target && state.hostReady && session.role === 'guest')
      socket.emit('rematch invitation', this.rematchInvitation(state));
  }

  @SubscribeMessage('ask rematch')
  async askRematch(socket: Socket, data: any) {
    const session = this.authorizeRoomEvent(socket, data?.name, data?.player);
    if (!session) return;
    try {
      const room = await this.roomService.findByName(session.roomName);
      if (
        !room ||
        room.id !== session.roomId ||
        room.status !== 'finished' ||
        !room.guestplayerid
      ) {
        socket.emit('error', {
          action: 'rematch',
          roomName: session.roomName,
          message: 'La partie doit être terminée pour proposer une revanche.',
        });
        return;
      }
      for (const [name, prior] of this.rematches) {
        if (prior.target?.name === room.name) this.rematches.delete(name);
      }
      if (
        socket.data.roomSession?.roomName !== session.roomName ||
        !socket.rooms.has(session.roomName)
      )
        return;
      let state = this.rematches.get(room.name);
      if (!state) {
        state = {
          roomId: room.id,
          roomName: room.name,
          hostId: room.hostplayerid,
          guestId: room.guestplayerid,
          requested: new Set(),
          phase: 'waiting',
        };
        this.rematches.set(room.name, state);
      }
      if (state.phase !== 'waiting') {
        socket.emit('rematch state', this.rematchSnapshot(state));
        if (state.phase === 'ready')
          socket.emit('rematch can start', { roomName: room.name });
        return;
      }
      if (data.cancel === true) state.requested.delete(session.role);
      else state.requested.add(session.role);
      if (state.requested.size === 2) state.phase = 'ready';
      this.publishRematch(state);
      if (state.phase === 'ready') {
        this.wss
          .to(room.name)
          .emit('rematch can start', { roomName: room.name });
      } else if (data.cancel !== true) {
        // Compatibility with clients released before the shared state.
        this.wss.to(room.name).emit('ask play again', {
          roomName: room.name,
          player: session.role,
        });
      }
    } catch (error) {
      this.logger.error('Failed to request rematch', error);
      socket.emit('error', {
        action: 'rematch',
        roomName: session.roomName,
        message: 'La proposition n’a pas été confirmée. Réessaie.',
      });
    }
  }

  @SubscribeMessage('rematch')
  async rematch(socket: Socket, data: any) {
    const userId = this.authenticatedUserId(socket, data?.hostId);
    if (
      !userId ||
      !this.validRoomName(socket, data?.oldRoomName) ||
      !this.validRoomName(socket, data?.newRoomName)
    )
      return;
    const state = this.rematches.get(data.oldRoomName);
    if (!state || state.hostId !== userId || state.requested.size !== 2) {
      socket.emit('error', {
        action: 'rematch',
        roomName: data.oldRoomName,
        message: 'Les deux joueurs doivent accepter la revanche.',
      });
      return;
    }
    // A duplicate after a lost acknowledgement returns the same room, never creates another.
    if (
      state.target &&
      [state.roomName, state.target.name].includes(
        socket.data.roomSession?.roomName,
      )
    ) {
      await this.bindSocketToRoom(socket, state.target, userId, 'host');
      await this.notifyRoomCreation(socket, state.target, userId);
      state.hostReady = true;
      this.wss
        .to(state.roomName)
        .emit('rematch invitation', this.rematchInvitation(state));
      return;
    }
    const previous = this.authorizeRoomEvent(
      socket,
      data.oldRoomName,
      undefined,
      'host',
    );
    if (!previous || state.phase === 'starting') return;
    state.phase = 'starting'; // Lock synchronously, before the first database await.
    this.publishRematch(state);
    let newRoom: any;
    try {
      const oldRoom = await this.roomService.findByName(previous.roomName);
      if (
        !oldRoom ||
        oldRoom.id !== previous.roomId ||
        oldRoom.status !== 'finished'
      )
        throw new Error('La partie précédente est fermée.');
      if (
        oldRoom.mode !== 'custom' &&
        !(await this.imageService.isCategoryVisible(oldRoom.category))
      ) {
        throw new Error(
          'Ce thème n’est plus disponible. Lance une nouvelle partie depuis l’accueil.',
        );
      }
      newRoom = await this.createRoomWithHost(
        data.newRoomName,
        userId,
        oldRoom.category,
      );
      if (oldRoom.mode === 'custom') {
        if (!this.lobby || !oldRoom.deck_id)
          throw new Error('Le deck de cette partie n’est plus disponible.');
        await this.lobby.change(
          newRoom.name,
          userId,
          { mode: 'custom', deckId: oldRoom.deck_id },
          0,
        );
        newRoom.category = 'custom';
        newRoom.mode = 'custom';
        newRoom.deck_id = oldRoom.deck_id;
      }
      // A quit during the database work must not resurrect an abandoned room.
      if (
        this.rematches.get(previous.roomName) !== state ||
        socket.data.roomSession?.roomName !== previous.roomName ||
        !socket.connected
      ) {
        throw new Error('La revanche a été interrompue.');
      }
      state.target = newRoom;
      await this.bindSocketToRoom(socket, newRoom, userId, 'host');
      await this.notifyRoomCreation(socket, newRoom, userId);
      state.hostReady = true;
      // Host membership and acknowledgement precede the guest's invitation.
      this.wss
        .to(previous.roomName)
        .emit('rematch invitation', this.rematchInvitation(state));
    } catch (error) {
      if (newRoom && socket.data.roomSession?.roomName !== newRoom.name) {
        await this.roomImageService.removeRoomImage(newRoom.id);
        await this.roomService.remove(newRoom.id);
        state.target = undefined;
      }
      if (!state.target) {
        state.phase = 'waiting';
        state.requested.clear();
        this.publishRematch(state);
      }
      socket.emit('error', {
        action: 'rematch',
        roomName: data.oldRoomName,
        message: error?.message || 'Impossible de préparer la revanche.',
      });
    }
  }

  @SubscribeMessage('join rematch')
  async joinRematch(socket: Socket, data: any) {
    const userId = this.authenticatedUserId(socket, data?.guestId);
    if (!userId || !this.validRoomName(socket, data?.newRoomName)) return;
    const previous = socket.data.roomSession as RoomSocketSession | undefined;
    const state = [...this.rematches.values()].find(
      (candidate) => candidate.target?.name === data.newRoomName,
    );
    if (
      !state ||
      !state.hostReady ||
      state.guestId !== userId ||
      previous?.role !== 'guest' ||
      (previous.roomName !== state.roomName &&
        previous.roomName !== state.target.name)
    ) {
      this.emitError(
        socket,
        'FORBIDDEN',
        'Cette revanche est réservée à l’adversaire invité.',
      );
      return;
    }
    if (state.joining) return;
    state.joining = true;
    try {
      const target = await this.roomService.findByName(state.target.name);
      if (this.rematches.get(state.roomName) !== state || !socket.connected)
        throw new Error('La revanche a été interrompue.');
      if (!target || target.hostplayerid !== state.hostId)
        throw new Error('Le salon de revanche est fermé.');
      const joinedRoom =
        target.guestplayerid === userId
          ? target
          : await this.addGuestToRoom(target.name, userId);
      if (
        this.rematches.get(state.roomName) !== state ||
        socket.data.roomSession?.roomName !== previous.roomName ||
        !socket.connected
      )
        throw new Error('La revanche a été interrompue.');
      await this.bindSocketToRoom(socket, joinedRoom, userId, 'guest');
      await this.notifyGuestJoined(socket, joinedRoom);
      // Keep the original entry until both clients received the join. It also
      // makes a repeated join idempotent while the acknowledgement is in flight.
      try {
        const previousRoom = await this.roomService.findByName(state.roomName);
        if (previousRoom?.id === state.roomId) {
          await this.roomImageService.removeRoomImage(previousRoom.id);
          await this.roomService.remove(previousRoom.id);
          this.turns.delete(previousRoom.name);
        }
      } catch (cleanupError) {
        this.logger.warn(
          `Rematch joined; old-room cleanup failed: ${cleanupError.message}`,
        );
      }
    } catch (error) {
      socket.emit('error', {
        action: 'rematch',
        roomName: data.newRoomName,
        message: error?.message || 'Impossible de rejoindre la revanche.',
      });
    } finally {
      state.joining = false;
    }
  }

  @SubscribeMessage('resume')
  async resumeRoom(socket: Socket, data: any) {
    try {
      const userId = this.authenticatedUserId(socket);
      if (!userId || !this.validRoomName(socket, data?.name)) return;

      let room = await this.roomService.findByName(data.name);
      const transition = this.rematches.get(data.name);
      let previousRoomName: string | undefined;
      if (
        transition?.target &&
        transition.hostReady &&
        [transition.hostId, transition.guestId].includes(userId)
      ) {
        const target = await this.roomService.findByName(
          transition.target.name,
        );
        if (
          target &&
          (target.hostplayerid === userId || target.guestplayerid === userId)
        ) {
          // The move committed, but its acknowledgement may have been lost.
          previousRoomName = data.name;
          room = target;
        }
      }
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

      if (previousRoomName && transition) {
        this.clearPendingDisconnect(
          this.sessionKey({
            roomId: transition.roomId,
            roomName: previousRoomName,
            userId,
            role,
          }),
        );
      }
      await this.bindSocketToRoom(socket, room, userId, role);
      socket.emit('room resumed', {
        ...(this.lobby ? await this.lobby.snapshot(room.name, userId) : {}),
        ...(this.atelierGame?.enabled
          ? await this.atelierGame.state(room.name)
          : {}),
        roomId: room.id,
        roomName: room.name,
        ...(previousRoomName ? { previousRoomName } : {}),
        category: room.category,
        mode: room.mode,
        deckId: room.deck_id,
        role,
        status: room.status,
        hostCharacterChosen: room.hostcharacterid !== null,
        guestCharacterChosen: room.guestcharacterid !== null,
        ...(this.turns.has(room.name)
          ? { turn: this.turns.get(room.name).turn }
          : {}),
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

  /**
   * Leaves the current room on purpose.
   *
   * Before the game starts, a leaving guest frees the seat and the host keeps
   * the room. In every other case the room is closed: the opponent receives
   * `quit` and is detached, so they can create or join another game at once.
   * Leaving is idempotent — the opponent may have closed the room first.
   */
  @SubscribeMessage('quit')
  async quitRoom(socket: Socket, data: any) {
    try {
      const userId = this.authenticatedUserId(socket, data?.userId);
      if (!userId || !this.validRoomName(socket, data?.name)) return;

      const session = socket.data.roomSession as RoomSocketSession | undefined;
      const transition = this.rematches.get(data.name);
      const movedFromRequestedRoom =
        session &&
        transition?.target?.name === session.roomName &&
        [transition.hostId, transition.guestId].includes(userId);
      if (
        !session ||
        (session.roomName !== data.name && !movedFromRequestedRoom)
      ) {
        await socket.leave(data.name);
        socket.emit('room left', { roomName: data.name });
        return { ok: true };
      }
      if (data?.id !== undefined && Number(data.id) !== session.roomId) {
        this.emitError(
          socket,
          'FORBIDDEN',
          'Room ID does not match this socket session',
        );
        return;
      }

      delete socket.data.roomSession;
      socket.data.playAgainRequested = false;
      this.clearPendingDisconnect(this.sessionKey(session));
      await socket.leave(session.roomName);

      const room = await this.roomService.findByName(session.roomName);
      if (room?.id === session.roomId) {
        const gameStarted = !!(
          room.selection_started_at ||
          room.hostcharacterid ||
          room.guestcharacterid
        );

        const reopened =
          session.role === 'guest' &&
          !gameStarted &&
          (await this.roomService.reopenRoomAfterGuestLeaves(
            room.name,
            session.userId,
          ));
        if (reopened) {
          this.releaseRematchReservation(room.name);
          this.wss.to(room.name).emit('guestLeftBeforeStart', {
            roomId: room.id,
            roomName: room.name,
          });
        } else {
          this.wss.to(room.name).emit('quit', { player: userId });
          await this.detachRoomSockets(room);
          await this.roomImageService.removeRoomImage(room.id);
          await this.roomService.remove(room.id);
        }
      }

      socket.emit('room left', {
        roomId: session.roomId,
        roomName: session.roomName,
      });
      return { ok: true };
    } catch (error) {
      this.logger.error(
        'Failed to quit room',
        error instanceof Error ? error.stack : String(error),
      );
      this.emitError(socket, 'QUIT_FAILED', 'Failed to quit room');
    }
  }

  /** Event emitted by app builds released before `quit` was wired. */
  @SubscribeMessage('leave')
  leaveRoom(socket: Socket, data: any) {
    return this.quitRoom(socket, { name: data?.name ?? data?.room });
  }
}
