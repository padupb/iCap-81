
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Configuração do Google Drive
const SCOPES = ['https://www.googleapis.com/auth/drive'];

export class GoogleDriveService {
  private drive: any;
  private auth: any;

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      // Usar Service Account credentials das configurações
      const { storage } = await import('./storage');
      
      const clientEmail = await storage.getSetting('google_drive_client_email');
      const privateKey = await storage.getSetting('google_drive_private_key');
      const projectId = await storage.getSetting('google_drive_project_id');

      if (!clientEmail?.value || !privateKey?.value) {
        console.log('⚠️ Google Drive não configurado - credenciais ausentes');
        return;
      }

      this.auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: clientEmail.value,
          private_key: privateKey.value.replace(/\\n/g, '\n'),
          project_id: projectId?.value || 'icap-system'
        },
        scopes: SCOPES,
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      console.log('✅ Google Drive API inicializada');
    } catch (error) {
      console.error('❌ Erro ao inicializar Google Drive:', error);
    }
  }

  async uploadFile(filePath: string, fileName: string, orderId: string): Promise<string | null> {
    if (!this.drive) {
      console.log('⚠️ Google Drive não configurado');
      return null;
    }

    try {
      // Criar pasta do pedido se não existir
      const folderId = await this.createOrGetFolder(orderId);

      // Upload do arquivo
      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      const media = {
        mimeType: this.getMimeType(fileName),
        body: fs.createReadStream(filePath)
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
      });

      const fileId = response.data.id;

      // Tornar o arquivo público
      await this.drive.permissions.create({
        fileId: fileId,
        resource: {
          role: 'reader',
          type: 'anyone'
        }
      });

      // Gerar link público
      const publicLink = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
      
      console.log(`✅ Arquivo ${fileName} enviado para Google Drive: ${publicLink}`);
      return publicLink;

    } catch (error) {
      console.error('❌ Erro ao fazer upload para Google Drive:', error);
      return null;
    }
  }

  private async createOrGetFolder(orderId: string): Promise<string> {
    try {
      // Buscar pasta raiz do i-CAP
      let icapFolderId = await this.findFolder('i-CAP Documentos');
      
      if (!icapFolderId) {
        // Criar pasta raiz
        const icapFolder = await this.drive.files.create({
          resource: {
            name: 'i-CAP Documentos',
            mimeType: 'application/vnd.google-apps.folder'
          },
          fields: 'id'
        });
        icapFolderId = icapFolder.data.id;
      }

      // Buscar pasta do pedido
      let orderFolderId = await this.findFolder(orderId, icapFolderId);
      
      if (!orderFolderId) {
        // Criar pasta do pedido
        const orderFolder = await this.drive.files.create({
          resource: {
            name: orderId,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [icapFolderId]
          },
          fields: 'id'
        });
        orderFolderId = orderFolder.data.id;
      }

      return orderFolderId;
    } catch (error) {
      console.error('❌ Erro ao criar/buscar pasta:', error);
      throw error;
    }
  }

  private async findFolder(name: string, parentId?: string): Promise<string | null> {
    try {
      const query = parentId 
        ? `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents`
        : `name='${name}' and mimeType='application/vnd.google-apps.folder'`;

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)'
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      return null;
    } catch (error) {
      console.error('❌ Erro ao buscar pasta:', error);
      return null;
    }
  }

  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
      case '.pdf':
        return 'application/pdf';
      case '.xml':
        return 'application/xml';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      default:
        return 'application/octet-stream';
    }
  }

  async uploadBuffer(buffer: Buffer, fileName: string, orderId: string): Promise<string | null> {
    if (!this.drive) {
      console.log('⚠️ Google Drive não configurado');
      return null;
    }

    try {
      const folderId = await this.createOrGetFolder(orderId);

      const fileMetadata = {
        name: fileName,
        parents: [folderId]
      };

      const media = {
        mimeType: this.getMimeType(fileName),
        body: buffer
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id'
      });

      const fileId = response.data.id;

      // Tornar público
      await this.drive.permissions.create({
        fileId: fileId,
        resource: {
          role: 'reader',
          type: 'anyone'
        }
      });

      const publicLink = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
      console.log(`✅ Buffer ${fileName} enviado para Google Drive: ${publicLink}`);
      return publicLink;

    } catch (error) {
      console.error('❌ Erro ao fazer upload de buffer para Google Drive:', error);
      return null;
    }
  }
}

export const googleDriveService = new GoogleDriveService();
