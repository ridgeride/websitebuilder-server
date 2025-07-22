import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import { insertSiteConfigSchema, insertProjectSchema, insertProductSchema, insertMessageSchema, insertMessageReplySchema } from "@shared/schema";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Site Configuration
  app.get("/api/config", async (req, res) => {
    try {
      const config = await storage.getSiteConfig();
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch site configuration" });
    }
  });

  app.put("/api/config", async (req, res) => {
    try {
      const validatedConfig = insertSiteConfigSchema.parse(req.body);
      const config = await storage.updateSiteConfig(validatedConfig);
      res.json(config);
    } catch (error) {
      res.status(400).json({ message: "Invalid configuration data" });
    }
  });

  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", upload.single('image'), async (req: MulterRequest, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      
      // Add image URL if file was uploaded
      if (req.file) {
        projectData.imageUrl = `/uploads/${req.file.filename}`;
      }

      const project = await storage.createProject(projectData);
      res.json(project);
    } catch (error) {
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  app.put("/api/projects/:id", upload.single('image'), async (req: MulterRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const projectData = insertProjectSchema.partial().parse(req.body);
      
      // Add image URL if file was uploaded
      if (req.file) {
        projectData.imageUrl = `/uploads/${req.file.filename}`;
      }

      const project = await storage.updateProject(id, projectData);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(400).json({ message: "Invalid project data" });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteProject(id);
      if (!deleted) {
        return res.status(404).json({ message: "Project not found" });
      }
      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/products", upload.single('image'), async (req: MulterRequest, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      
      // Add image URL if file was uploaded
      if (req.file) {
        productData.imageUrl = `/uploads/${req.file.filename}`;
      }

      const product = await storage.createProduct(productData);
      res.json(product);
    } catch (error) {
      res.status(400).json({ message: "Invalid product data" });
    }
  });

  app.put("/api/products/:id", upload.single('image'), async (req: MulterRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const productData = insertProductSchema.partial().parse(req.body);
      
      // Add image URL if file was uploaded
      if (req.file) {
        productData.imageUrl = `/uploads/${req.file.filename}`;
      }

      const product = await storage.updateProduct(id, productData);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(400).json({ message: "Invalid product data" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteProduct(id);
      if (!deleted) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Messages
  app.get("/api/messages", async (req, res) => {
    try {
      const messages = await storage.getMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get("/api/messages/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const message = await storage.getMessage(id);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      res.json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch message" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(messageData);
      res.json(message);
    } catch (error) {
      res.status(400).json({ message: "Invalid message data" });
    }
  });

  app.put("/api/messages/:id/read", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const marked = await storage.markMessageAsRead(id);
      if (!marked) {
        return res.status(404).json({ message: "Message not found" });
      }
      res.json({ message: "Message marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  // Message Replies
  app.get("/api/messages/:id/replies", async (req, res) => {
    try {
      const messageId = parseInt(req.params.id);
      const replies = await storage.getMessageReplies(messageId);
      res.json(replies);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch message replies" });
    }
  });

  app.post("/api/messages/:id/replies", async (req, res) => {
    try {
      const messageId = parseInt(req.params.id);
      const replyData = insertMessageReplySchema.parse({
        ...req.body,
        messageId
      });
      const reply = await storage.createMessageReply(replyData);
      res.json(reply);
    } catch (error) {
      res.status(400).json({ message: "Invalid reply data" });
    }
  });

  // Serve uploaded files
  app.use('/uploads', (req, res, next) => {
    const filePath = path.join(process.cwd(), 'uploads', req.path);
    res.sendFile(filePath, (err) => {
      if (err) {
        res.status(404).json({ message: 'File not found' });
      }
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
