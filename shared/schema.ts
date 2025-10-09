import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  password: text("password").notNull(),
  companyId: integer("company_id"),
  roleId: integer("role_id"),
  canConfirmDelivery: boolean("can_confirm_delivery").default(false),
  canCreateOrder: boolean("can_create_order").default(false),
  canCreatePurchaseOrder: boolean("can_create_purchase_order").default(false),
  canEditPurchaseOrders: boolean("can_edit_purchase_orders").default(false),
  primeiroLogin: boolean("primeiro_login").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Companies table
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cnpj: text("cnpj").notNull().unique(),
  address: text("address").notNull(),
  categoryId: integer("category_id").notNull(),
  approverId: integer("approver_id"),
  contractNumber: text("contract_number"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Company categories table
export const companyCategories = pgTable("company_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  requiresApprover: boolean("requires_approver").default(false),
  receivesPurchaseOrders: boolean("receives_purchase_orders").default(false),
  requiresContract: boolean("requires_contract").default(false),
  canEditPurchaseOrders: boolean("can_edit_purchase_orders").default(false),
});

// User roles table
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  categoryId: integer("category_id").notNull(),
  permissions: text("permissions").array(),
});

// Products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unitId: integer("unit_id").notNull(),
  confirmationType: text("confirmation_type").notNull().default("nota_fiscal"), // 'nota_fiscal' ou 'numero_pedido'
  createdAt: timestamp("created_at").defaultNow(),
});

// Units table
export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(),
});

// Orders table
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderId: text("order_id").notNull().unique(),
  productId: integer("product_id").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),

  supplierId: integer("supplier_id").notNull(),
  workLocation: text("work_location").notNull(),
  deliveryDate: timestamp("delivery_date").notNull(),
  status: text("status").notNull().default("Criado"),
  isUrgent: boolean("is_urgent").default(false),
  userId: integer("user_id").notNull(),
  purchaseOrderId: integer("purchase_order_id"),
  createdAt: timestamp("created_at").defaultNow(),
  documentosCarregados: boolean("documentos_carregados").default(false),
  documentosInfo: text("documentos_info"), // JSON com informações dos documentos
  numeroPedido: text("numero_pedido"), // Número do pedido quando confirmationType = 'numero_pedido'
});

// Purchase orders table
export const purchaseOrders = pgTable("purchase_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  companyId: integer("company_id").notNull(),
  validFrom: timestamp("valid_from").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  status: text("status").notNull().default("Ativo"),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Purchase order items table
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: serial("id").primaryKey(),
  purchaseOrderId: integer("purchase_order_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
});

// Relations
export const purchaseOrdersRelations = relations(
  purchaseOrders,
  ({ one, many }) => ({
    company: one(companies, {
      fields: [purchaseOrders.companyId],
      references: [companies.id],
    }),
    items: many(purchaseOrderItems),
    orders: many(orders),
  }),
);

export const purchaseOrderItemsRelations = relations(
  purchaseOrderItems,
  ({ one }) => ({
    purchaseOrder: one(purchaseOrders, {
      fields: [purchaseOrderItems.purchaseOrderId],
      references: [purchaseOrders.id],
    }),
    product: one(products, {
      fields: [purchaseOrderItems.productId],
      references: [products.id],
    }),
  }),
);

export const ordersRelations = relations(orders, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [orders.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  product: one(products, {
    fields: [orders.productId],
    references: [products.id],
  }),
  supplier: one(companies, {
    fields: [orders.supplierId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
}));

// System logs table
export const systemLogs = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(),
  itemType: text("item_type").notNull(),
  itemId: text("item_id"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tracking points table
export const trackingPoints = pgTable("tracking_points", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  status: text("status").notNull(),
  comment: text("comment"),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  latitude: decimal("latitude", { precision: 10, scale: 6 }),
  longitude: decimal("longitude", { precision: 10, scale: 6 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Settings table
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
});

// Documents table
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id),
  documentType: text("document_type").notNull(), // 'nota_pdf', 'nota_xml', 'certificado_pdf'
  fileName: text("file_name").notNull(),
  originalName: text("original_name"),
  fileSize: integer("file_size"),
  filePath: text("file_path").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  uploadedBy: integer("uploaded_by").references(() => users.id),
});

// Types
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

// Insert schemas
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true })
  .extend({
    phone: z
      .string()
      .nullable()
      .transform((val) => (val === "" || val === null ? null : val)),
    password: z
      .string()
      .min(4, "A senha deve ter pelo menos 4 caracteres")
      .optional(),
  });
export const insertCompanySchema = createInsertSchema(companies)
  .omit({ id: true, createdAt: true })
  .extend({
    contractNumber: z.string().optional(),
  });
export const insertCompanyCategorySchema = createInsertSchema(companyCategories)
  .omit({ id: true })
  .extend({
    receivesPurchaseOrders: z.boolean().default(false),
    requiresContract: z.boolean().default(false),
    canEditPurchaseOrders: z.boolean().default(false),
  });
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
});
export const insertProductSchema = createInsertSchema(products)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    confirmationType: z.enum(["nota_fiscal", "numero_pedido"]).default("nota_fiscal"),
  });
export const insertUnitSchema = createInsertSchema(units).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders)
  .omit({ id: true, orderId: true, createdAt: true, isUrgent: true })
  .extend({
    purchaseOrderId: z.number().optional(),
  });
export const insertPurchaseOrderSchema = createInsertSchema(
  purchaseOrders,
).omit({ id: true, createdAt: true });
export const insertPurchaseOrderItemSchema = createInsertSchema(
  purchaseOrderItems,
).omit({ id: true });
export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({
  id: true,
  createdAt: true,
});
export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
});
export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});
export const insertTrackingPointSchema = createInsertSchema(trackingPoints)
  .omit({ id: true, createdAt: true })
  .extend({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  });

// Types
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type CompanyCategory = typeof companyCategories.$inferSelect;
export type InsertCompanyCategory = z.infer<typeof insertCompanyCategorySchema>;
export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Unit = typeof units.$inferSelect;
export type InsertUnit = z.infer<typeof insertUnitSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = z.infer<
  typeof insertPurchaseOrderItemSchema
>;
export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type TrackingPoint = typeof trackingPoints.$inferSelect;
export type InsertTrackingPoint = z.infer<typeof insertTrackingPointSchema>;

export const insertCompanySchemaZod = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  cnpj: z.string().min(1, "CNPJ é obrigatório"),
  razaoSocial: z.string().optional(),
  address: z.string().min(1, "Endereço é obrigatório"),
  categoryId: z.number().min(1, "Categoria é obrigatória"),
  approverId: z.number().optional(),
  contractNumber: z.string().optional(),
});