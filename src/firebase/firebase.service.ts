import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private storage: admin.storage.Storage;

  constructor(private configService: ConfigService) { }

  async onModuleInit() {
    // Initialiser Firebase Admin SDK
    if (!admin.apps.length) {
      const serviceAccount = {
        type: 'service_account',
        project_id: this.configService.get<string>('FIREBASE_PROJECT_ID'),
        private_key_id: this.configService.get<string>(
          'FIREBASE_PRIVATE_KEY_ID',
        ),
        private_key: this.configService
          .get<string>('FIREBASE_PRIVATE_KEY')
          ?.replace(/\\n/g, '\n'),
        client_email: this.configService.get<string>('FIREBASE_CLIENT_EMAIL'),
        client_id: this.configService.get<string>('FIREBASE_CLIENT_ID'),
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url:
          'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${this.configService.get<string>(
          'FIREBASE_CLIENT_EMAIL',
        )}`,
      };

      admin.initializeApp({
        credential: admin.credential.cert(
          serviceAccount as admin.ServiceAccount,
        ),
        storageBucket: this.configService.get<string>(
          'FIREBASE_STORAGE_BUCKET',
        ),
      });
    }

    this.storage = admin.storage();
  }

  async uploadProfileImage(
    userId: number,
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    try {
      const bucket = this.storage.bucket();
      const fileName = `profiles/${userId}.png`; // Toujours en PNG
      const file = bucket.file(fileName);

      // Upload du fichier
      await file.save(imageBuffer, {
        metadata: {
          contentType: 'image/png', // Force en PNG
          cacheControl: 'public, max-age=31536000', // Cache 1 an
        },
        validation: 'crc32c',
      });

      // Rendre le fichier public
      await file.makePublic();

      // Retourner l'URL publique
      return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    } catch (error) {
      console.error("Erreur lors de l'upload Firebase:", error);
      throw new Error("Échec de l'upload de l'image");
    }
  }

  async uploadLibraryImage(
    userId: number,
    imageBuffer: Buffer,
    mimeType: string,
    imageId: string,
    deckId?: number,
  ): Promise<string> {
    try {
      const bucket = this.storage.bucket();
      const extension = mimeType.includes('png') ? 'png' : 'jpg';

      // Si deckId fourni, utiliser la nouvelle structure de dossiers
      const basePath = deckId
        ? `userLibrary/${userId}/${deckId}`
        : `user-libraries/${userId}`;

      const fileName = `${basePath}/${imageId}.${extension}`;
      const file = bucket.file(fileName);

      // Upload du fichier
      await file.save(imageBuffer, {
        metadata: {
          contentType: mimeType,
          cacheControl: 'public, max-age=31536000', // Cache 1 an
        },
        validation: 'crc32c',
      });

      // Rendre le fichier public
      await file.makePublic();

      // Retourner l'URL publique
      return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    } catch (error) {
      console.error("Erreur lors de l'upload Firebase (library):", error);
      throw new Error("Échec de l'upload de l'image");
    }
  }

  async deleteLibraryImage(userId: number, imageId: string): Promise<void> {
    try {
      const bucket = this.storage.bucket();
      // Essayer les deux extensions
      for (const ext of ['jpg', 'png']) {
        const fileName = `user-libraries/${userId}/${imageId}.${ext}`;
        const file = bucket.file(fileName);
        const [exists] = await file.exists();
        if (exists) {
          await file.delete();
          console.log(`Image bibliothèque supprimée: ${fileName}`);
          return;
        }
      }
    } catch (error) {
      console.error('Erreur lors de la suppression Firebase (library):', error);
    }
  }

  async deleteProfileImage(userId: number): Promise<void> {
    try {
      const bucket = this.storage.bucket();
      const fileName = `profiles/${userId}.png`;
      const file = bucket.file(fileName);

      // Vérifier si le fichier existe
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
        console.log(`Image de profil supprimée pour l'utilisateur ${userId}`);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression Firebase:', error);
      throw new Error("Échec de la suppression de l'image");
    }
  }
}
