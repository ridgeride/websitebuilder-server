import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const siteConfig = pgTable("site_config", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  heroTitle: text("hero_title"),
  heroDescription: text("hero_description"),
  aboutTitle: text("about_title").default("Over Ons"),
  aboutDescription: text("about_description"),
  
  // Design & Branding
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  primaryColor: text("primary_color").default("#2563eb"),
  secondaryColor: text("secondary_color").default("#1e40af"),
  accentColor: text("accent_color").default("#059669"),
  textColor: text("text_color").default("#1f2937"),
  backgroundColor: text("background_color").default("#ffffff"),
  fontFamily: text("font_family").default("Inter"),
  
  // Contact Info
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  
  // Social Media
  facebookUrl: text("facebook_url"),
  twitterUrl: text("twitter_url"),
  instagramUrl: text("instagram_url"),
  linkedinUrl: text("linkedin_url"),
  
  // SEO
  siteTitle: text("site_title"),
  seoDescription: text("seo_description"),
  seoKeywords: text("seo_keywords"),
  metaDescription: text("meta_description"),
  metaKeywords: text("meta_keywords"),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("concept"), // concept, progress, completed
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: text("price").notNull(), // Store as string for display flexibility
  imageUrl: text("image_url"),
  status: text("status").notNull().default("active"), // active, inactive
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messageReplies = pgTable("message_replies", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => messages.id),
  reply: text("reply").notNull(),
  isFromAdmin: boolean("is_from_admin").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertSiteConfigSchema = createInsertSchema(siteConfig).omit({
  id: true,
}).extend({
  heroTitle: z.string().optional(),
  heroDescription: z.string().optional(),
  aboutTitle: z.string().optional(),
  aboutDescription: z.string().optional(),
  
  // Design & Branding
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  textColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontFamily: z.string().optional(),
  
  // Contact Info
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  
  // Social Media
  facebookUrl: z.string().optional(),
  twitterUrl: z.string().optional(),
  instagramUrl: z.string().optional(),
  linkedinUrl: z.string().optional(),
  
  // SEO
  siteTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  seoKeywords: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.string().optional(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  isRead: true,
  createdAt: true,
});

export const insertMessageReplySchema = createInsertSchema(messageReplies).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type SiteConfig = typeof siteConfig.$inferSelect;
export type InsertSiteConfig = z.infer<typeof insertSiteConfigSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type MessageReply = typeof messageReplies.$inferSelect;
export type InsertMessageReply = z.infer<typeof insertMessageReplySchema>;
