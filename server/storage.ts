import {
  users, siteConfig, projects, products, messages, messageReplies,
  type User, type InsertUser,
  type SiteConfig, type InsertSiteConfig,
  type Project, type InsertProject,
  type Product, type InsertProduct,
  type Message, type InsertMessage,
  type MessageReply, type InsertMessageReply
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Site Config
  getSiteConfig(): Promise<SiteConfig | undefined>;
  updateSiteConfig(config: InsertSiteConfig): Promise<SiteConfig>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;

  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  // Messages
  getMessages(): Promise<Message[]>;
  getMessage(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: number): Promise<boolean>;

  // Message Replies
  getMessageReplies(messageId: number): Promise<MessageReply[]>;
  createMessageReply(reply: InsertMessageReply): Promise<MessageReply>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    this.initializeDefaults();
  }

  private async initializeDefaults() {
    // Check if site config exists, if not create default
    const existingConfig = await this.getSiteConfig();
    if (!existingConfig) {
      await this.updateSiteConfig({
        companyName: "Voorbeeld Bedrijf BV",
        heroTitle: "Welkom bij Voorbeeld Bedrijf BV",
        heroDescription: "Wij leveren professionele diensten en hoogwaardige producten die uw verwachtingen overtreffen.",
        aboutTitle: "Over Ons",
        aboutDescription: "Met meer dan 10 jaar ervaring in de branche, zijn wij uw betrouwbare partner voor innovatieve oplossingen. Ons toegewijde team van experts werkt samen om uw visie werkelijkheid te maken en uw bedrijfsdoelen te overtreffen.",
        primaryColor: "#2563eb",
        email: "info@voorbeeldbedrijf.nl",
        phone: "+31 20 123 4567",
        address: "Hoofdstraat 123, 1234 AB Amsterdam",
        facebookUrl: undefined,
        instagramUrl: undefined,
        linkedinUrl: undefined,
        metaDescription: "Voorbeeld Bedrijf BV - Professionele diensten en hoogwaardige producten. Meer dan 10 jaar ervaring in innovatieve oplossingen.",
        metaKeywords: "professionele diensten, hoogwaardige producten, innovatieve oplossingen, betrouwbare partner",
      });
    }

    // Add demo projects if none exist
    const existingProjects = await this.getProjects();
    if (existingProjects.length === 0) {
      const demoProjects = [
        {
          title: "Modern Kantoorgebouw Amsterdam",
          description: "Ontwerp en realisatie van een modern kantoorgebouw met duurzame materialen en energy-efficient systemen.",
          category: "architectuur",
          status: "completed" as const,
          imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&h=600&fit=crop",
        },
        {
          title: "Luxe Woonhuis Interieur",
          description: "Complete interieurinrichting van een luxe woonhuis met moderne elementen en klassieke accenten.",
          category: "interieur",
          status: "completed" as const,
          imageUrl: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop",
        },
        {
          title: "E-commerce Platform",
          description: "Ontwikkeling van een volledig responsive e-commerce platform met moderne technologieën.",
          category: "web",
          status: "progress" as const,
          imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop",
        }
      ];

      for (const project of demoProjects) {
        await this.createProject(project);
      }
    }

    // Add demo products if none exist
    const existingProducts = await this.getProducts();
    if (existingProducts.length === 0) {
      const demoProducts = [
        {
          title: "Premium Consultancy Pakket",
          description: "Uitgebreide consultancy diensten voor uw project van start tot finish.",
          price: "€2.500",
          status: "active" as const,
          imageUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop",
        },
        {
          title: "Design Workshop",
          description: "Interactieve workshop over modern design principes en trends.",
          price: "€450",
          status: "active" as const,
          imageUrl: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&h=600&fit=crop",
        },
        {
          title: "Digitale Strategie Audit",
          description: "Complete audit van uw huidige digitale strategie met concrete verbetervoorstellen.",
          price: "€1.200",
          status: "active" as const,
          imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop",
        }
      ];

      for (const product of demoProducts) {
        await this.createProduct(product);
      }
    }
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Site Config
  async getSiteConfig(): Promise<SiteConfig | undefined> {
    const [config] = await db.select().from(siteConfig).limit(1);
    return config || undefined;
  }

  async updateSiteConfig(config: InsertSiteConfig): Promise<SiteConfig> {
    const existingConfig = await this.getSiteConfig();
    
    if (existingConfig) {
      const [updated] = await db
        .update(siteConfig)
        .set(config)
        .where(eq(siteConfig.id, existingConfig.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(siteConfig).values(config).returning();
      return created;
    }
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(projects.createdAt);
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db
      .update(projects)
      .set(project)
      .where(eq(projects.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProject(id: number): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Products
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(products.createdAt);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [created] = await db.insert(products).values(product).returning();
    return created;
  }

  async updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set(product)
      .where(eq(products.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Messages
  async getMessages(): Promise<Message[]> {
    return await db.select().from(messages).orderBy(messages.createdAt);
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message || undefined;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(message).returning();
    return created;
  }

  async markMessageAsRead(id: number): Promise<boolean> {
    const result = await db
      .update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Message Replies
  async getMessageReplies(messageId: number): Promise<MessageReply[]> {
    return await db
      .select()
      .from(messageReplies)
      .where(eq(messageReplies.messageId, messageId))
      .orderBy(messageReplies.createdAt);
  }

  async createMessageReply(reply: InsertMessageReply): Promise<MessageReply> {
    const [created] = await db.insert(messageReplies).values(reply).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();