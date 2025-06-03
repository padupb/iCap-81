import { pgTable, serial, text, timestamp, boolean, integer, decimal } from "drizzle-orm/pg-core";

// Tabela de usuários
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  permissions: text("permissions").array(),
  isDeveloper: boolean("is_developer").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Tabela de empresas
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cnpj: text("cnpj"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow()
});

// Tabela de produtos
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  unit: text("unit").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

// Tabela de ordens de compra
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  companyId: integer("company_id").references(() => companies.id),
  productId: integer("product_id").references(() => products.id),
  quantity: decimal("quantity").notNull(),
  deliveryDate: timestamp("delivery_date").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});

// Tabela de pedidos
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  companyId: integer("company_id").references(() => companies.id),
  productId: integer("product_id").references(() => products.id),
  purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id),
  quantity: decimal("quantity").notNull(),
  status: text("status").notNull(),
  isUrgent: boolean("is_urgent").default(false),
  createdBy: integer("created_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Tabela de configurações
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Tabela de logs
export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  itemType: text("item_type"),
  itemId: text("item_id"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow()
});