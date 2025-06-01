import {
  users, companies, companyCategories, userRoles, products, units,
  orders, purchaseOrders, purchaseOrderItems, systemLogs, settings, documents,
  type User, type InsertUser, type Company, type InsertCompany,
  type CompanyCategory, type InsertCompanyCategory, type UserRole, type InsertUserRole,
  type Product, type InsertProduct, type Unit, type InsertUnit,
  type Order, type InsertOrder, type PurchaseOrder, type InsertPurchaseOrder,
  type PurchaseOrderItem, type InsertPurchaseOrderItem,
  type SystemLog, type InsertSystemLog, type Setting, type InsertSetting,
  type Document, type InsertDocument
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;

  // Companies
  getCompany(id: number): Promise<Company | undefined>;
  getAllCompanies(): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<boolean>;

  // Company Categories
  getCompanyCategory(id: number): Promise<CompanyCategory | undefined>;
  getAllCompanyCategories(): Promise<CompanyCategory[]>;
  createCompanyCategory(category: InsertCompanyCategory): Promise<CompanyCategory>;
  updateCompanyCategory(id: number, category: Partial<InsertCompanyCategory>): Promise<CompanyCategory | undefined>;
  deleteCompanyCategory(id: number): Promise<boolean>;

  // User Roles
  getUserRole(id: number): Promise<UserRole | undefined>;
  getAllUserRoles(): Promise<UserRole[]>;
  getUserRolesByCategory(categoryId: number): Promise<UserRole[]>;
  createUserRole(role: InsertUserRole): Promise<UserRole>;
  updateUserRole(id: number, role: Partial<InsertUserRole>): Promise<UserRole | undefined>;
  deleteUserRole(id: number): Promise<boolean>;

  // Products
  getProduct(id: number): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  // Units
  getUnit(id: number): Promise<Unit | undefined>;
  getAllUnits(): Promise<Unit[]>;
  createUnit(unit: InsertUnit): Promise<Unit>;
  updateUnit(id: number, unit: Partial<InsertUnit>): Promise<Unit | undefined>;
  deleteUnit(id: number): Promise<boolean>;

  // Orders
  getOrder(id: number): Promise<Order | undefined>;
  getOrderByOrderId(orderId: string): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;
  getOrdersByStatus(status: string): Promise<Order[]>;
  getUrgentOrders(): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, order: Partial<Order>): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<boolean>;

  // Purchase Orders
  getPurchaseOrder(id: number): Promise<PurchaseOrder | undefined>;
  getPurchaseOrderByNumber(orderNumber: string): Promise<PurchaseOrder | undefined>;
  getAllPurchaseOrders(): Promise<PurchaseOrder[]>;
  createPurchaseOrder(order: InsertPurchaseOrder): Promise<PurchaseOrder>;
  updatePurchaseOrder(id: number, order: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined>;
  deletePurchaseOrder(id: number): Promise<boolean>;

  // Purchase Order Items
  getPurchaseOrderItems(purchaseOrderId: number): Promise<PurchaseOrderItem[]>;
  createPurchaseOrderItem(item: InsertPurchaseOrderItem): Promise<PurchaseOrderItem>;
  deletePurchaseOrderItem(id: number): Promise<boolean>;

  // System Logs
  getAllLogs(): Promise<SystemLog[]>;
  createLog(log: InsertSystemLog): Promise<SystemLog>;

  // Settings
  getSetting(key: string): Promise<Setting | undefined>;
  getAllSettings(): Promise<Setting[]>;
  createOrUpdateSetting(setting: InsertSetting): Promise<Setting>;

  // Documents
  getDocumentsByOrderId(orderId: number): Promise<Document[]>;
  getDocument(id: number): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  deleteDocument(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private companies: Map<number, Company> = new Map();
  private companyCategories: Map<number, CompanyCategory> = new Map();
  private userRoles: Map<number, UserRole> = new Map();
  private products: Map<number, Product> = new Map();
  private units: Map<number, Unit> = new Map();
  private orders: Map<number, Order> = new Map();
  private purchaseOrders: Map<number, PurchaseOrder> = new Map();
  private purchaseOrderItems: Map<number, PurchaseOrderItem> = new Map();
  private systemLogs: Map<number, SystemLog> = new Map();
  private settings: Map<string, Setting> = new Map();

  private currentId = 1;

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Initialize default units
    const defaultUnits = [
      { name: "Toneladas", abbreviation: "t" },
      { name: "Metros Cúbicos", abbreviation: "m³" },
      { name: "Litros", abbreviation: "L" },
      { name: "Quilogramas", abbreviation: "kg" },
      { name: "Unidades", abbreviation: "un" },
    ];

    defaultUnits.forEach(unit => {
      const newUnit: Unit = { id: this.currentId++, ...unit };
      this.units.set(newUnit.id, newUnit);
    });

    // Initialize default company categories
    const defaultCategories = [
      { name: "Construtora", requiresApprover: true },
      { name: "Fornecedor", requiresApprover: false },
      { name: "Transportadora", requiresApprover: false },
    ];

    defaultCategories.forEach(category => {
      const newCategory: CompanyCategory = { id: this.currentId++, ...category };
      this.companyCategories.set(newCategory.id, newCategory);
    });

    // Initialize default settings
    const defaultSettings = [
      { key: "urgent_days_threshold", value: "7", description: "Dias para considerar pedido urgente" },
      { key: "approval_timeout_hours", value: "48", description: "Tempo limite para aprovação em horas" },
      { key: "google_maps_api_key", value: "", description: "Chave da API Google Maps" },
      { key: "app_name", value: "i-CAP 5.0", description: "Nome da aplicação" },
      { key: "keyuser_email", value: "padupb@admin.icap", description: "E-mail do superadministrador" },
      { key: "keyuser_password", value: "170824", description: "Senha do superadministrador" },
    ];

    defaultSettings.forEach(setting => {
      const newSetting: Setting = { id: this.currentId++, ...setting };
      this.settings.set(setting.key, newSetting);
    });
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id, createdAt: new Date() };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updateData };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  // Companies
  async getCompany(id: number): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async getAllCompanies(): Promise<Company[]> {
    return Array.from(this.companies.values());
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const id = this.currentId++;
    const company: Company = { ...insertCompany, id, createdAt: new Date() };
    this.companies.set(id, company);
    return company;
  }

  async updateCompany(id: number, updateData: Partial<InsertCompany>): Promise<Company | undefined> {
    const company = this.companies.get(id);
    if (!company) return undefined;
    const updated = { ...company, ...updateData };
    this.companies.set(id, updated);
    return updated;
  }

  async deleteCompany(id: number): Promise<boolean> {
    return this.companies.delete(id);
  }

  // Company Categories
  async getCompanyCategory(id: number): Promise<CompanyCategory | undefined> {
    return this.companyCategories.get(id);
  }

  async getAllCompanyCategories(): Promise<CompanyCategory[]> {
    return Array.from(this.companyCategories.values());
  }

  async createCompanyCategory(insertCategory: InsertCompanyCategory): Promise<CompanyCategory> {
    const id = this.currentId++;
    const category: CompanyCategory = { ...insertCategory, id };
    this.companyCategories.set(id, category);
    return category;
  }

  async updateCompanyCategory(id: number, updateData: Partial<InsertCompanyCategory>): Promise<CompanyCategory | undefined> {
    const category = this.companyCategories.get(id);
    if (!category) return undefined;
    const updated = { ...category, ...updateData };
    this.companyCategories.set(id, updated);
    return updated;
  }

  async deleteCompanyCategory(id: number): Promise<boolean> {
    return this.companyCategories.delete(id);
  }

  // User Roles
  async getUserRole(id: number): Promise<UserRole | undefined> {
    return this.userRoles.get(id);
  }

  async getAllUserRoles(): Promise<UserRole[]> {
    return Array.from(this.userRoles.values());
  }

  async getUserRolesByCategory(categoryId: number): Promise<UserRole[]> {
    return Array.from(this.userRoles.values()).filter(role => role.categoryId === categoryId);
  }

  async createUserRole(insertRole: InsertUserRole): Promise<UserRole> {
    const id = this.currentId++;
    const role: UserRole = { ...insertRole, id };
    this.userRoles.set(id, role);
    return role;
  }

  async updateUserRole(id: number, updateData: Partial<InsertUserRole>): Promise<UserRole | undefined> {
    const role = this.userRoles.get(id);
    if (!role) return undefined;
    const updated = { ...role, ...updateData };
    this.userRoles.set(id, updated);
    return updated;
  }

  async deleteUserRole(id: number): Promise<boolean> {
    return this.userRoles.delete(id);
  }

  // Products
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = this.currentId++;
    const product: Product = { ...insertProduct, id, createdAt: new Date() };
    this.products.set(id, product);
    return product;
  }

  async updateProduct(id: number, updateData: Partial<InsertProduct>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    const updated = { ...product, ...updateData };
    this.products.set(id, updated);
    return updated;
  }

  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }

  // Units
  async getUnit(id: number): Promise<Unit | undefined> {
    return this.units.get(id);
  }

  async getAllUnits(): Promise<Unit[]> {
    return Array.from(this.units.values());
  }

  async createUnit(insertUnit: InsertUnit): Promise<Unit> {
    const id = this.currentId++;
    const unit: Unit = { ...insertUnit, id };
    this.units.set(id, unit);
    return unit;
  }

  async updateUnit(id: number, updateData: Partial<InsertUnit>): Promise<Unit | undefined> {
    const unit = this.units.get(id);
    if (!unit) return undefined;
    const updated = { ...unit, ...updateData };
    this.units.set(id, updated);
    return updated;
  }

  async deleteUnit(id: number): Promise<boolean> {
    return this.units.delete(id);
  }

  // Orders
  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrderByOrderId(orderId: string): Promise<Order | undefined> {
    return Array.from(this.orders.values()).find(order => order.orderId === orderId);
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async getOrdersByStatus(status: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.status === status);
  }

  async getUrgentOrders(): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.isUrgent && order.status === "Em Aprovação");
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = this.currentId++;
    const now = new Date();
    const orderId = this.generateOrderId();

    // Check if order is urgent (delivery date < 7 days)
    const deliveryDate = new Date(insertOrder.deliveryDate);
    const daysDiff = Math.ceil((deliveryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    const isUrgent = daysDiff < 7;

    const order: Order = {
      ...insertOrder,
      id,
      orderId,
      isUrgent,
      status: isUrgent ? "Em Aprovação" : "Registrado",
      createdAt: now
    };

    this.orders.set(id, order);
    return order;
  }

  async updateOrder(id: number, updateData: Partial<Order>): Promise<Order | undefined> {
    const order = this.orders.get(id);
    if (!order) return undefined;
    const updated = { ...order, ...updateData };
    this.orders.set(id, updated);
    return updated;
  }

  async deleteOrder(id: number): Promise<boolean> {
    return this.orders.delete(id);
  }

  private generateOrderId(): string {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    return `CAV${day}${month}${year}${hours}${minutes}`;
  }

  // Purchase Orders
  async getPurchaseOrder(id: number): Promise<PurchaseOrder | undefined> {
    return this.purchaseOrders.get(id);
  }

  async getPurchaseOrderByNumber(orderNumber: string): Promise<PurchaseOrder | undefined> {
    return Array.from(this.purchaseOrders.values()).find(order => order.orderNumber === orderNumber);
  }

  async getAllPurchaseOrders(): Promise<PurchaseOrder[]> {
    return Array.from(this.purchaseOrders.values());
  }

  async createPurchaseOrder(insertPurchaseOrder: InsertPurchaseOrder): Promise<PurchaseOrder> {
    const id = this.currentId++;
    const orderNumber = `OC${Date.now()}`;
    const purchaseOrder: PurchaseOrder = {
      ...insertPurchaseOrder,
      id,
      orderNumber,
      createdAt: new Date()
    };
    this.purchaseOrders.set(id, purchaseOrder);
    return purchaseOrder;
  }

  async updatePurchaseOrder(id: number, updateData: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined> {
    const purchaseOrder = this.purchaseOrders.get(id);
    if (!purchaseOrder) return undefined;
    const updated = { ...purchaseOrder, ...updateData };
    this.purchaseOrders.set(id, updated);
    return updated;
  }

  async deletePurchaseOrder(id: number): Promise<boolean> {
    return this.purchaseOrders.delete(id);
  }

  // Purchase Order Items
  async getPurchaseOrderItems(purchaseOrderId: number): Promise<PurchaseOrderItem[]> {
    return Array.from(this.purchaseOrderItems.values()).filter(item => item.purchaseOrderId === purchaseOrderId);
  }

  async createPurchaseOrderItem(insertItem: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    const id = this.currentId++;
    const item: PurchaseOrderItem = { ...insertItem, id };
    this.purchaseOrderItems.set(id, item);
    return item;
  }

  async deletePurchaseOrderItem(id: number): Promise<boolean> {
    return this.purchaseOrderItems.delete(id);
  }

  // System Logs
  async getAllLogs(): Promise<SystemLog[]> {
    return Array.from(this.systemLogs.values()).sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async createLog(insertLog: InsertSystemLog): Promise<SystemLog> {
    const id = this.currentId++;
    const log: SystemLog = { ...insertLog, id, createdAt: new Date() };
    this.systemLogs.set(id, log);
    return log;
  }

  // Settings
  async getSetting(key: string): Promise<Setting | undefined> {
    return this.settings.get(key);
  }

  async getAllSettings(): Promise<Setting[]> {
    return Array.from(this.settings.values());
  }

  async createOrUpdateSetting(insertSetting: InsertSetting): Promise<Setting> {
    const existing = this.settings.get(insertSetting.key);
    if (existing) {
      const updated = { ...existing, ...insertSetting };
      this.settings.set(insertSetting.key, updated);
      return updated;
    } else {
      const id = this.currentId++;
      const setting: Setting = { ...insertSetting, id };
      this.settings.set(insertSetting.key, setting);
      return setting;
    }
  }

  // Documents (placeholder implementation for MemStorage)
  async getDocumentsByOrderId(orderId: number): Promise<Document[]> {
    return [];
  }

  async getDocument(id: number): Promise<Document | undefined> {
    return undefined;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const id = this.currentId++;
    const newDocument: Document = { ...document, id };
    return newDocument;
  }

  async deleteDocument(id: number): Promise<boolean> {
    return true;
  }
}

// Substituindo o armazenamento em memória pelo de banco de dados
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";
import bcrypt from 'bcrypt';

// Implementação de armazenamento com banco de dados
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Definir senha padrão se não fornecida
    const passwordToHash = insertUser.password || 'icap123';
    const hashedPassword = await bcrypt.hash(passwordToHash, 10);

    // Garantir que campos opcionais sejam null em vez de undefined
    const safeInsertUser = {
      ...insertUser,
      password: hashedPassword,
      phone: insertUser.phone ?? null,
      companyId: insertUser.companyId ?? null,
      roleId: insertUser.roleId ?? null,
      canConfirmDelivery: insertUser.canConfirmDelivery ?? false,
      primeiroLogin: true // Sempre true para novos usuários
    };
    const [user] = await db.insert(users).values(safeInsertUser).returning();
    return user;
  }

  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User | undefined> {
    // Garantir tratamento adequado para o campo canConfirmDelivery
    const safeUpdateData = {
      ...updateData,
      phone: updateData.phone ?? undefined,
      companyId: updateData.companyId ?? undefined,
      roleId: updateData.roleId ?? undefined,
      canConfirmDelivery: updateData.canConfirmDelivery !== undefined ? updateData.canConfirmDelivery : undefined
    };
    const [user] = await db.update(users).set(safeUpdateData).where(eq(users.id, id)).returning();
    return user;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return true; // Assume success if no error is thrown
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async getAllCompanies(): Promise<Company[]> {
    return await db.select().from(companies);
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    // Garantir que campos opcionais sejam null em vez de undefined
    const safeInsertCompany = {
      ...insertCompany,
      approverId: insertCompany.approverId ?? null
    };
    const [company] = await db.insert(companies).values(safeInsertCompany).returning();
    return company;
  }

  async updateCompany(id: number, updateData: Partial<InsertCompany>): Promise<Company | undefined> {
    const [company] = await db.update(companies).set(updateData).where(eq(companies.id, id)).returning();
    return company;
  }

  async deleteCompany(id: number): Promise<boolean> {
    const result = await db.delete(companies).where(eq(companies.id, id));
    return true;
  }

  async getCompanyCategory(id: number): Promise<CompanyCategory | undefined> {
    const [category] = await db.select().from(companyCategories).where(eq(companyCategories.id, id));
    return category || undefined;
  }

  async getAllCompanyCategories(): Promise<CompanyCategory[]> {
    return await db.select().from(companyCategories);
  }

  async createCompanyCategory(insertCategory: InsertCompanyCategory): Promise<CompanyCategory> {
    // Garantir que campos opcionais sejam null em vez de undefined
    const safeInsertCategory = {
      ...insertCategory,
      requiresApprover: insertCategory.requiresApprover ?? null,
      requiresContract: insertCategory.requiresContract ?? null
    };
    const [category] = await db.insert(companyCategories).values(safeInsertCategory).returning();
    return category;
  }

  async updateCompanyCategory(id: number, updateData: Partial<InsertCompanyCategory>): Promise<CompanyCategory | undefined> {
    const [category] = await db.update(companyCategories).set(updateData).where(eq(companyCategories.id, id)).returning();
    return category;
  }

  async deleteCompanyCategory(id: number): Promise<boolean> {
    const result = await db.delete(companyCategories).where(eq(companyCategories.id, id));
    return true;
  }

  async getUserRole(id: number): Promise<UserRole | undefined> {
    const [role] = await db.select().from(userRoles).where(eq(userRoles.id, id));
    return role || undefined;
  }

  async getAllUserRoles(): Promise<UserRole[]> {
    return await db.select().from(userRoles);
  }

  async getUserRolesByCategory(categoryId: number): Promise<UserRole[]> {
    return await db.select().from(userRoles).where(eq(userRoles.categoryId, categoryId));
  }

  async createUserRole(insertRole: InsertUserRole): Promise<UserRole> {
    // Garantir que campos opcionais sejam null em vez de undefined
    const safeInsertRole = {
      ...insertRole,
      permissions: insertRole.permissions ?? null
    };
    const [role] = await db.insert(userRoles).values(safeInsertRole).returning();
    return role;
  }

  async updateUserRole(id: number, updateData: Partial<InsertUserRole>): Promise<UserRole | undefined> {
    const [role] = await db.update(userRoles).set(updateData).where(eq(userRoles.id, id)).returning();
    return role;
  }

  async deleteUserRole(id: number): Promise<boolean> {
    const result = await db.delete(userRoles).where(eq(userRoles.id, id));
    return true;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    // Garantir que campos opcionais sejam null em vez de undefined
    const safeInsertProduct = {
      ...insertProduct,
      referencePrice: insertProduct.referencePrice ?? null
    };
    const [product] = await db.insert(products).values(safeInsertProduct).returning();
    return product;
  }

  async updateProduct(id: number, updateData: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db.update(products).set(updateData).where(eq(products.id, id)).returning();
    return product;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return true;
  }

  async getUnit(id: number): Promise<Unit | undefined> {
    const [unit] = await db.select().from(units).where(eq(units.id, id));
    return unit || undefined;
  }

  async getAllUnits(): Promise<Unit[]> {
    return await db.select().from(units);
  }

  async createUnit(insertUnit: InsertUnit): Promise<Unit> {
    const [unit] = await db.insert(units).values(insertUnit).returning();
    return unit;
  }

  async updateUnit(id: number, updateData: Partial<InsertUnit>): Promise<Unit | undefined> {
    const [unit] = await db.update(units).set(updateData).where(eq(units.id, id)).returning();
    return unit;
  }

  async deleteUnit(id: number): Promise<boolean> {
    const result = await db.delete(units).where(eq(units.id, id));
    return true;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  async getOrderByOrderId(orderId: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.orderId, orderId));
    return order || undefined;
  }

  async getAllOrders(): Promise<Order[]> {
    const result = await db
      .select({
        id: orders.id,
        orderId: orders.orderId,
        purchaseOrderId: orders.purchaseOrderId,
        productId: orders.productId,
        productName: products.name,
        quantity: orders.quantity,
        supplierId: orders.supplierId,
        workLocation: orders.workLocation,
        deliveryDate: orders.deliveryDate,
        status: orders.status,
        isUrgent: orders.isUrgent,
        userId: orders.userId,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id));

    return result.map(row => ({
      id: row.id,
      orderId: row.orderId,
      purchaseOrderId: row.purchaseOrderId,
      productId: row.productId,
      productName: row.productName,
      quantity: row.quantity,
      supplierId: row.supplierId,
      workLocation: row.workLocation,
      deliveryDate: row.deliveryDate,
      status: row.status,
      isUrgent: row.isUrgent,
      userId: row.userId,
      createdAt: row.createdAt,
    })) as Order[];
  }

  async getOrdersByStatus(status: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.status, status));
  }

  async getUrgentOrders(): Promise<Order[]> {
    console.log('🔍 Buscando pedidos urgentes na storage...');
    
    const result = await db
      .select({
        id: orders.id,
        orderId: orders.orderId,
        purchaseOrderId: orders.purchaseOrderId,
        productId: orders.productId,
        productName: products.name,
        quantity: orders.quantity,
        supplierId: orders.supplierId,
        workLocation: orders.workLocation,
        deliveryDate: orders.deliveryDate,
        status: orders.status,
        isUrgent: orders.isUrgent,
        userId: orders.userId,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .where(and(
        eq(orders.isUrgent, true),
        eq(orders.status, "Registrado")
      ));

    console.log(`📊 Storage: encontrados ${result.length} pedidos urgentes com status Registrado`);
    
    // Debug adicional: buscar TODOS os pedidos urgentes, independente do status
    const allUrgent = await db
      .select({
        id: orders.id,
        orderId: orders.orderId,
        status: orders.status,
        isUrgent: orders.isUrgent,
        deliveryDate: orders.deliveryDate
      })
      .from(orders)
      .where(eq(orders.isUrgent, true));
    
    console.log(`🔍 Debug: total de pedidos marcados como urgentes (todos os status):`, allUrgent.length);
    allUrgent.forEach(order => {
      console.log(`  - ${order.orderId}: status=${order.status}, isUrgent=${order.isUrgent}, entrega=${order.deliveryDate}`);
    });

    return result.map(row => ({
      id: row.id,
      orderId: row.orderId,
      purchaseOrderId: row.purchaseOrderId,
      productId: row.productId,
      productName: row.productName,
      quantity: row.quantity,
      supplierId: row.supplierId,
      workLocation: row.workLocation,
      deliveryDate: row.deliveryDate,
      status: row.status,
      isUrgent: row.isUrgent,
      userId: row.userId,
      createdAt: row.createdAt,
    })) as Order[];
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    // Gerar OrderID automático
    const orderId = this.generateOrderId();
    
    // Calcular se o pedido é urgente baseado na data de entrega
    const now = new Date();
    const deliveryDate = new Date(insertOrder.deliveryDate);
    const daysDiff = Math.ceil((deliveryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    const isUrgent = daysDiff <= 7; // Pedidos com entrega em 7 dias ou menos são urgentes
    
    console.log(`📅 Verificação de urgência para pedido ${orderId}:`, {
      deliveryDate: deliveryDate.toISOString(),
      daysDiff,
      isUrgent
    });
    
    const [order] = await db.insert(orders).values({
      ...insertOrder,
      orderId,
      isUrgent,
      createdAt: new Date()
    }).returning();
    return order;
  }

  async updateOrder(id: number, updateData: Partial<Order>): Promise<Order | undefined> {
    const [order] = await db.update(orders).set(updateData).where(eq(orders.id, id)).returning();
    return order;
  }

  async deleteOrder(id: number): Promise<boolean> {
    const result = await db.delete(orders).where(eq(orders.id, id));
    return true;
  }

  private generateOrderId(): string {
    const now = new Date();
    const prefix = "CAP";
    const datePart = `${now.getDate().toString().padStart(2, '0')}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getFullYear().toString().slice(2)}`;
    const timePart = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
    return `${prefix}${datePart}${timePart}`;
  }

  async getPurchaseOrder(id: number): Promise<PurchaseOrder | undefined> {
    const [purchaseOrder] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    return purchaseOrder || undefined;
  }

  async getPurchaseOrderByNumber(orderNumber: string): Promise<PurchaseOrder | undefined> {
    const [purchaseOrder] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.orderNumber, orderNumber));
    return purchaseOrder|| undefined;
  }

  async getAllPurchaseOrders(): Promise<PurchaseOrder[]> {
    return await db.select().from(purchaseOrders);
  }

  async createPurchaseOrder(insertPurchaseOrder: InsertPurchaseOrder): Promise<PurchaseOrder> {
    try {
      console.log("Storage: criar purchase order com dados:", JSON.stringify(insertPurchaseOrder, null, 2));

      // O número da ordem agora vem do frontend, enviado pelo usuário
      // Garantir que todos os campos estejam no formato correto
      const orderData = {
        orderNumber: String(insertPurchaseOrder.orderNumber),
        companyId: Number(insertPurchaseOrder.companyId),
        validUntil: new Date(insertPurchaseOrder.validUntil),
        userId: Number(insertPurchaseOrder.userId || 1),
        status: insertPurchaseOrder.status || "Ativo"
      };

      console.log("Storage: dados formatados para insert:", JSON.stringify(orderData, null, 2));

      // Inserção direta usando executar SQL para evitar problemas de tipagem
      const { pool } = await import("./db");
      const result = await pool.query(`
        INSERT INTO purchase_orders 
        (order_number, company_id, valid_until, user_id, status) 
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        orderData.orderNumber,
        orderData.companyId,
        orderData.validUntil,
        orderData.userId,
        orderData.status
      ]);

      // Formatar resultado para o formato esperado
      if (result.rows.length > 0) {
        const row = result.rows[0];
        const purchaseOrder: PurchaseOrder = {
          id: row.id,
          orderNumber: row.order_number,
          companyId: row.company_id,
          validUntil: row.valid_until,
          status: row.status,
          userId: row.user_id,
          createdAt: row.created_at
        };

        console.log("Storage: ordem criada com sucesso:", JSON.stringify(purchaseOrder, null, 2));
        return purchaseOrder;
      } else {
        throw new Error("Falha ao criar ordem de compra");
      }
    } catch (error) {
      console.error("Erro ao criar ordem de compra no storage:", error);
      throw error;
    }
  }

  async updatePurchaseOrder(id: number, updateData: Partial<InsertPurchaseOrder>): Promise<PurchaseOrder | undefined> {
    const [purchaseOrder] = await db.update(purchaseOrders).set(updateData).where(eq(purchaseOrders.id, id)).returning();
    return purchaseOrder;
  }

  async deletePurchaseOrder(id: number): Promise<boolean> {
    const result = await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
    return true;
  }

  async getPurchaseOrderItems(purchaseOrderId: number): Promise<PurchaseOrderItem[]> {
    return await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
  }

  async createPurchaseOrderItem(insertItem: InsertPurchaseOrderItem): Promise<PurchaseOrderItem> {
    try {
      console.log("Storage: criar item de ordem com dados:", JSON.stringify(insertItem, null, 2));

      // Garantir que todos os campos estejam no formato correto
      const itemData = {
        purchaseOrderId: Number(insertItem.purchaseOrderId),
        productId: Number(insertItem.productId),
        quantity: typeof insertItem.quantity === 'string' ? parseFloat(insertItem.quantity) : Number(insertItem.quantity)
      };

      console.log("Storage: dados formatados para item:", JSON.stringify(itemData, null, 2));

      // Inserção direta usando SQL para evitar problemas de tipagem
      const { pool } = await import("./db");
      const result = await pool.query(`
        INSERT INTO purchase_order_items 
        (purchase_order_id, product_id, quantity) 
        VALUES ($1, $2, $3)
        RETURNING *
      `, [
        itemData.purchaseOrderId,
        itemData.productId,
        itemData.quantity
      ]);

      // Formatar resultado para o formato esperado
      if (result.rows.length > 0) {
        const row = result.rows[0];
        const item: PurchaseOrderItem = {
          id: row.id,
          purchaseOrderId: row.purchase_order_id,
          productId: row.product_id,
          quantity: row.quantity
        };

        console.log("Storage: item criado com sucesso:", JSON.stringify(item, null, 2));
        return item;
      } else {
        throw new Error("Falha ao criar item da ordem de compra");
      }
    } catch (error) {
      console.error("Erro ao criar item de ordem no storage:", error);
      throw error;
    }
  }

  async deletePurchaseOrderItem(id: number): Promise<boolean> {
    const result = await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
    return true;
  }

  async getAllLogs(): Promise<SystemLog[]> {
    return await db.select().from(systemLogs);
  }

  async createLog(insertLog: InsertSystemLog): Promise<SystemLog> {
    const [log] = await db.insert(systemLogs).values({
      ...insertLog,
      createdAt: new Date()
    }).returning();
    return log;
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting || undefined;
  }

  async getAllSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  async createOrUpdateSetting(insertSetting: InsertSetting): Promise<Setting> {
    // Verificar se a configuração já existe
    const existingSetting = await this.getSetting(insertSetting.key);

    if (existingSetting) {
      // Atualizar configuração existente
      const [setting] = await db.update(settings)
        .set(insertSetting)
        .where(eq(settings.key, insertSetting.key))
        .returning();
      return setting;
    } else {
      // Criar nova configuração
      const [setting] = await db.insert(settings).values(insertSetting).returning();
      return setting;
    }
  }

  // Documents
  async getDocumentsByOrderId(orderId: number): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.orderId, orderId));
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db.insert(documents).values(insertDocument).returning();
    return document;
  }

  async deleteDocument(id: number): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id));
    return true;
  }
}

// Escolher o tipo de storage baseado na disponibilidade do banco de dados
import { db } from "./db";

export const storage = db ? new DatabaseStorage() : new MemStorage();