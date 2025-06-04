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
} from "../shared/schema";

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
  getUrgentOrdersForApprover(userId: number): Promise<Order[]>;
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
      { key: "order_id_pattern", value: "EMPRESA{DD}{MM}{YY}{NNNN}", description: "Padrão de numeração de pedidos (EMPRESA = sigla da empresa criadora)" },
      { key: "use_company_acronym", value: "true", description: "Usar sigla da empresa criadora no prefixo dos pedidos" },
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

    // Check if order is urgent (delivery date <= 7 days)
    const deliveryDate = new Date(insertOrder.deliveryDate);
    const daysDiff = Math.ceil((deliveryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    const isUrgent = daysDiff <= 7;

    // Definir status baseado na urgência:
    // - Pedidos urgentes: "Registrado" (precisam de aprovação)
    // - Pedidos não urgentes: "Aprovado" (aprovação automática)
    const status = isUrgent ? "Registrado" : "Aprovado";

    const order: Order = {
      ...insertOrder,
      id,
      orderId,
      isUrgent,
      status,
      createdAt: now
    };

    this.orders.set(id, order);
    return order;
  }

  private generateOrderId(): string {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    let baseOrderId = `CAV${day}${month}${year}${hours}${minutes}`;
    let counter = 0;
    let orderId = baseOrderId;

    // Verificar se o ID já existe na memória e incrementar se necessário
    while (Array.from(this.orders.values()).some(order => order.orderId === orderId)) {
      counter++;

      // Extrair os últimos 2 dígitos e somar o counter
      const baseNumber = parseInt(baseOrderId.slice(-2));
      const newNumber = (baseNumber + counter).toString().padStart(2, '0');

      if (baseNumber + counter > 99) {
        const newNumberStr = (baseNumber + counter).toString();
        orderId = baseOrderId.slice(0, -2) + newNumberStr;
      } else {
        orderId = baseOrderId.slice(0, -2) + newNumber;
      }
    }

    return orderId;
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

  async getUrgentOrdersForApprover(userId: number): Promise<Order[]> {
    // Para MemStorage, retornar lista vazia
    return [];
  }
}

// Substituindo o armazenamento em memória pelo de banco de dados
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";
import bcrypt from 'bcrypt';

// Implementação de armazenamento com banco de dados
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    if (!db) return undefined;
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    } catch (error) {
      console.error(`Erro ao buscar usuário ${id}:`, error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    if (!db) return [];
    try {
      return await db.select().from(users);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      return [];
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!db) {
      throw new Error('Database not configured');
    }
    try {
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
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
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

  async getUrgentOrdersForApprover(userId: number): Promise<Order[]> {
    console.log(`🔍 Buscando pedidos urgentes para aprovador ID: ${userId}`);

    // Importar pool dinamicamente
    const { pool } = await import("./db");

    // Primeiro, verificar de quais empresas o usuário é aprovador
    const approverCompaniesResult = await pool.query(`
      SELECT id, name, cnpj FROM companies WHERE approver_id = $1
    `, [userId]);

    console.log(`👔 Usuário ${userId} é aprovador de ${approverCompaniesResult.rows.length} empresa(s):`);
    approverCompaniesResult.rows.forEach((company: any) => {
      console.log(`  - ${company.name} (CNPJ: ${company.cnpj})`);
    });

    // Buscar pedidos urgentes que precisam de aprovação baseado no critério obra de destino
    // O usuário deve ser aprovador da empresa que corresponde ao CNPJ da obra de destino
    const result = await pool.query(`
      SELECT DISTINCT
        o.id,
        o.order_id as "orderId",
        o.purchase_order_id as "purchaseOrderId",
        o.product_id as "productId",
        p.name as "productName",
        o.quantity,
        o.supplier_id as "supplierId",
        o.work_location as "workLocation",
        o.delivery_date as "deliveryDate",
        o.status,
        o.is_urgent as "isUrgent",
        o.user_id as "userId",
        o.created_at as "createdAt",
        oc.numero_ordem as "numeroOrdem",
        oc.cnpj as "cnpjDestino",
        c_obra_destino.name as "obraDestinoNome",
        c_obra_destino.approver_id as "obraApproverId"
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN ordens_compra oc ON o.purchase_order_id = oc.id
      LEFT JOIN companies c_obra_destino ON oc.cnpj = c_obra_destino.cnpj
      WHERE o.is_urgent = true 
        AND o.status = 'Registrado'
        AND c_obra_destino.approver_id = $1
      ORDER BY o.created_at DESC
    `, [userId]);

    console.log(`📊 Storage: encontrados ${result.rows.length} pedidos urgentes onde usuário ${userId} é aprovador da obra de destino`);

    // Log detalhado para debug
    if (result.rows.length > 0) {
      console.log(`📋 Detalhes dos pedidos urgentes:`);
      result.rows.forEach((row: any) => {
        console.log(`  - Pedido ${row.orderId}:`);
        console.log(`    • Ordem: ${row.numeroOrdem}`);
        console.log(`    • CNPJ destino: ${row.cnpjDestino}`);
        console.log(`    • Obra: ${row.obraDestinoNome}`);
        console.log(`    • Aprovador da obra: ${row.obraApproverId}`);
        console.log(`    • Status: ${row.status}`);
      });
    } else {
      console.log(`🤔 Nenhum pedido encontrado. Verificando todos os pedidos urgentes...`);

      // Debug: mostrar todos os pedidos urgentes registrados
      const allUrgentResult = await pool.query(`
        SELECT 
          o.order_id,
          o.status,
          o.is_urgent,
          oc.numero_ordem,
          oc.cnpj,
          c.name as obra_nome,
          c.approver_id
        FROM orders o
        LEFT JOIN ordens_compra oc ON o.purchase_order_id = oc.id
        LEFT JOIN companies c ON oc.cnpj = c.cnpj
        WHERE o.is_urgent = true AND o.status = 'Registrado'
      `);

      console.log(`🔍 Todos os pedidos urgentes registrados (${allUrgentResult.rows.length}):`);
      allUrgentResult.rows.forEach((row: any) => {
        console.log(`  - ${row.order_id}: obra "${row.obra_nome}" (aprovador: ${row.approver_id})`);
      });
    }

    return result.rows.map((row: any) => ({
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
    // Gerar OrderID automático baseado na empresa criadora
    const orderId = await this.generateOrderIdForOrder(insertOrder);

    // Calcular se o pedido é urgente baseado na data de entrega
    const now = new Date();
    const deliveryDate = new Date(insertOrder.deliveryDate);
    const daysDiff = Math.ceil((deliveryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    const isUrgent = daysDiff <= 7; // Pedidos com entrega em 7 dias ou menos são urgentes

    // Definir status baseado na urgência:
    // - Pedidos urgentes: "Registrado" (precisam de aprovação)
    // - Pedidos não urgentes: "Aprovado" (aprovação automática)
    const status = isUrgent ? "Registrado" : "Aprovado";

    console.log(`📅 Storage - Data recebida: ${insertOrder.deliveryDate}`);
    console.log(`📅 Storage - Data processada: ${deliveryDate.toISOString()}`);
    console.log(`📅 Storage - Data em formato brasileiro: ${deliveryDate.toLocaleDateString('pt-BR')}`);
    
    console.log(`📅 Verificação de urgência para pedido ${orderId}:`, {
      deliveryDate: deliveryDate.toISOString(),
      deliveryDateBR: deliveryDate.toLocaleDateString('pt-BR'),
      daysDiff,
      isUrgent,
      status,
      solucaoAplicada: "data preservada do calendário"
    });

    // Inserir a ordem no banco de dados
    const [order] = await db.insert(orders).values({
      ...insertOrder,
      orderId,
      isUrgent,
      status,
      createdAt: new Date()
    }).returning();

    // Após inserir a ordem, recalcular o saldo disponível da ordem de compra
    if (insertOrder.purchaseOrderId && insertOrder.productId) {
      await this.recalculatePurchaseOrderBalance(insertOrder.purchaseOrderId, insertOrder.productId);
    }

    return order;
  }

  private async generateOrderIdForOrder(insertOrder: InsertOrder): Promise<string> {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString().slice(-2);
    
    // Buscar próximo número sequencial
    const sequentialNumber = await this.getNextSequentialNumber();
    const paddedNumber = sequentialNumber.toString().padStart(4, '0');

    let prefix = "CAP"; // Padrão caso não consiga determinar

    try {
      // Buscar a empresa criadora da obra através da ordem de compra
      if (insertOrder.purchaseOrderId) {
        const { pool } = await import("./db");
        
        // Buscar a ordem de compra para pegar o CNPJ da obra de destino
        const purchaseOrderResult = await pool.query(`
          SELECT oc.cnpj 
          FROM ordens_compra oc 
          WHERE oc.id = $1
        `, [insertOrder.purchaseOrderId]);

        if (purchaseOrderResult.rows.length > 0) {
          const cnpjObra = purchaseOrderResult.rows[0].cnpj;
          
          // Buscar a empresa dona da obra pelo CNPJ
          const companyResult = await pool.query(`
            SELECT name 
            FROM companies 
            WHERE cnpj = $1
          `, [cnpjObra]);

          if (companyResult.rows.length > 0) {
            const companyName = companyResult.rows[0].name;
            
            // Buscar se há uma sigla personalizada configurada para esta empresa
            const companyId = await this.getCompanyIdByName(companyName);
            if (companyId) {
              const customAcronymSetting = await this.getSetting(`company_${companyId}_acronym`);
              if (customAcronymSetting?.value) {
                prefix = customAcronymSetting.value;
                console.log(`📝 Usando sigla personalizada "${prefix}" para empresa "${companyName}"`);
              } else {
                prefix = this.generateCompanyAcronym(companyName);
                console.log(`📝 Gerada sigla automática "${prefix}" para empresa "${companyName}"`);
              }
            } else {
              prefix = this.generateCompanyAcronym(companyName);
              console.log(`📝 Gerada sigla automática "${prefix}" para empresa "${companyName}"`);
            }
          }
        }
      }
    } catch (error) {
      console.log("Erro ao determinar empresa criadora, usando prefixo padrão CAP:", error);
    }

    let baseOrderId = `${prefix}${day}${month}${year}${paddedNumber}`;
    let counter = 0;
    let orderId = baseOrderId;

    // Verificar duplicidade
    const { pool } = await import("./db");

    while (true) {
      const existingOrder = await pool.query(
        "SELECT id FROM orders WHERE order_id = $1 LIMIT 1",
        [orderId]
      );

      if (existingOrder.rows.length === 0) {
        break; // ID não existe, pode usar
      }

      counter++;
      const newNumber = (parseInt(paddedNumber) + counter).toString().padStart(4, '0');
      orderId = `${prefix}${day}${month}${year}${newNumber}`;
    }

    return orderId;
  }

  async updateOrder(id: number, updateData: Partial<Order>): Promise<Order | undefined> {
    const [order] = await db.update(orders).set(updateData).where(eq(orders.id, id)).returning();

    // Recalcular o saldo disponível da ordem de compra após atualizar a ordem
    if (order && order.purchaseOrderId && order.productId) {
      await this.recalculatePurchaseOrderBalance(order.purchaseOrderId, order.productId);
    }

    return order;
  }

  async deleteOrder(id: number): Promise<boolean> {
    // Antes de deletar a ordem, obter informações para recalcular o balanço
    const [orderToDelete] = await db.select().from(orders).where(eq(orders.id, id));

    const result = await db.delete(orders).where(eq(orders.id, id));

    // Recalcular o saldo disponível da ordem de compra após deletar a ordem
    if (orderToDelete && orderToDelete.purchaseOrderId && orderToDelete.productId) {
      await this.recalculatePurchaseOrderBalance(orderToDelete.purchaseOrderId, orderToDelete.productId);
    }

    return true;
  }

  private generateCompanyAcronym(companyName: string): string {
    // Remover palavras comuns e conectores
    const commonWords = ['ltda', 'sa', 'me', 'epp', 'eireli', 'do', 'da', 'de', 'dos', 'das', 'e', 'em', 'com', 'para', 'por', 'sobre'];
    
    // Dividir o nome em palavras e filtrar palavras vazias e conectores
    const words = companyName
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove pontuação
      .split(/\s+/)
      .filter(word => word.length > 0 && !commonWords.includes(word));

    let acronym = '';
    
    if (words.length === 1) {
      // Se só tem uma palavra, pegar as primeiras 3 letras
      acronym = words[0].substring(0, 3).toUpperCase();
    } else if (words.length === 2) {
      // Se tem duas palavras, pegar 2 letras da primeira e 1 da segunda
      acronym = words[0].substring(0, 2).toUpperCase() + words[1].substring(0, 1).toUpperCase();
    } else if (words.length >= 3) {
      // Se tem 3 ou mais palavras, pegar a primeira letra de cada uma das 3 primeiras
      acronym = words.slice(0, 3).map(word => word.charAt(0).toUpperCase()).join('');
    }

    // Garantir que a sigla tenha pelo menos 2 caracteres e no máximo 4
    if (acronym.length < 2) {
      acronym = companyName.substring(0, 3).toUpperCase().replace(/[^\w]/g, '');
    }
    if (acronym.length > 4) {
      acronym = acronym.substring(0, 4);
    }

    return acronym;
  }

  private async generateOrderId(): Promise<string> {
    // Buscar configuração de padrão personalizado se existir
    const patternSetting = await this.getSetting("order_id_pattern");
    
    if (patternSetting?.value && patternSetting.value !== "CAP{DD}{MM}{YY}{NNNN}") {
      // Se há um padrão personalizado configurado, usar ele
      return await this.generateOrderIdWithPattern(patternSetting.value);
    }

    // Usar novo padrão baseado na empresa
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString().slice(-2);
    
    // Buscar próximo número sequencial
    const sequentialNumber = await this.getNextSequentialNumber();
    const paddedNumber = sequentialNumber.toString().padStart(4, '0');

    // Por padrão usar "CAP" se não conseguir determinar a empresa
    let prefix = "CAP";

    try {
      // Tentar determinar a empresa criadora (isso será implementado quando tivermos o contexto do usuário)
      // Por enquanto, vamos usar o padrão antigo
      prefix = "CAP";
    } catch (error) {
      console.log("Usando prefixo padrão CAP");
    }

    let baseOrderId = `${prefix}${day}${month}${year}${paddedNumber}`;
    let counter = 0;
    let orderId = baseOrderId;

    // Usar query do banco de dados para verificar se o ID já existe
    const { pool } = await import("./db");

    while (true) {
      const existingOrder = await pool.query(
        "SELECT id FROM orders WHERE order_id = $1 LIMIT 1",
        [orderId]
      );

      if (existingOrder.rows.length === 0) {
        break; // ID não existe, pode usar
      }

      counter++;
      const newNumber = (parseInt(paddedNumber) + counter).toString().padStart(4, '0');
      orderId = `${prefix}${day}${month}${year}${newNumber}`;
    }

    return orderId;
  }

  private async generateOrderIdWithPattern(pattern: string): Promise<string> {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear().toString().slice(-2);
    
    // Buscar próximo número sequencial
    const sequentialNumber = await this.getNextSequentialNumber();
    const paddedNumber = sequentialNumber.toString().padStart(4, '0');
    
    // Substituir placeholders
    return pattern
      .replace('{DD}', day)
      .replace('{MM}', month)
      .replace('{YY}', year)
      .replace('{NNNN}', paddedNumber);
  }

  private async getCompanyIdByName(companyName: string): Promise<number | null> {
    try {
      const { pool } = await import("./db");
      const result = await pool.query(`
        SELECT id FROM companies WHERE name = $1 LIMIT 1
      `, [companyName]);
      
      if (result.rows.length > 0) {
        return result.rows[0].id;
      }
      return null;
    } catch (error) {
      console.error("Erro ao buscar ID da empresa:", error);
      return null;
    }
  }

  private async getNextSequentialNumber(): Promise<number> {
    const { pool } = await import("./db");
    
    // Buscar o maior número sequencial usado hoje
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    
    const result = await pool.query(`
      SELECT order_id FROM orders 
      WHERE DATE(created_at) = $1 
      ORDER BY id DESC 
      LIMIT 1
    `, [todayStr]);

    if (result.rows.length === 0) {
      return 1; // Primeiro pedido do dia
    }

    // Extrair o número sequencial do último pedido
    const lastOrderId = result.rows[0].order_id;
    const numberMatch = lastOrderId.match(/(\d{4})$/);
    
    if (numberMatch) {
      return parseInt(numberMatch[1]) + 1;
    }
    
    return 1;
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

      // Buscar os dados da ordem de compra e do produto
      const purchaseOrderResult = await pool.query(
        "SELECT id, order_number FROM purchase_orders WHERE id = $1",
        [itemData.purchaseOrderId]
      );

      const productResult = await pool.query(
        "SELECT id, name FROM products WHERE id = $1",
        [itemData.productId]
      );

      if (purchaseOrderResult.rows.length === 0 || productResult.rows.length === 0) {
        throw new Error("Ordem de compra ou produto não encontrados");
      }

      const purchaseOrderData = purchaseOrderResult.rows[0];
      const productData = productResult.rows[0];

      // Buscar a quantidade total aprovada na ordem de compra
      const totalAprovadoResult = await pool.query(
        `SELECT COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as total_aprovado
         FROM purchase_order_items 
         WHERE purchase_order_id = $1 AND product_id = $2`,
        [itemData.purchaseOrderId, itemData.productId]
      );

      const totalAprovado = totalAprovadoResult.rows[0].total_aprovado || 0;

      // Buscar quantidade já usada em pedidos (excluindo cancelados)
      const usadoResult = await pool.query(
        `SELECT COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as total_usado
         FROM orders 
         WHERE purchase_order_id = $1 AND product_id = $2 AND status != 'Cancelado'`,
        [itemData.purchaseOrderId, itemData.productId]
      );

      const totalUsado = usadoResult.rows[0].total_usado || 0;

      // Calcular o saldo disponível
      const saldoDisponivel = totalAprovado - totalUsado;

      console.log(`📊 Balanço da ordem ${purchaseOrderData.order_number}, produto ${productData.name}:`, {
        totalAprovado,
        totalUsado,
        saldoDisponivel,
        novaQuantidade: itemData.quantity
      });

      // Verificar se a quantidade do novo item excede o saldo disponível
      if (itemData.quantity > saldoDisponivel) {
        throw new Error(`Quantidade solicitada excede o saldo disponível (${saldoDisponivel})`);
      }

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

        // Recalcular o saldo da ordem de compra
        await this.recalculatePurchaseOrderBalance(itemData.purchaseOrderId, itemData.productId);

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
    // Antes de deletar, pegar os dados do item para recalcular o balanço
    const [itemToDelete] = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));

    const result = await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));

    // Recalcular o saldo disponível da ordem de compra após deletar o item
    if (itemToDelete && itemToDelete.purchaseOrderId && itemToDelete.productId) {
      await this.recalculatePurchaseOrderBalance(itemToDelete.purchaseOrderId, itemToDelete.productId);
    }

    return true;
  }

  // Função utilitária para recalcular o balanço da ordem de compra
  private async recalculatePurchaseOrderBalance(purchaseOrderId: number, productId: number): Promise<void> {
    const { pool } = await import("./db");

    console.log(`🔄 Recalculando balanço da OC ${purchaseOrderId}, produto ${productId}...`);

    // Buscar a quantidade total aprovada na ordem de compra
    const totalAprovadoResult = await pool.query(
      `SELECT COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as total_aprovado
       FROM purchase_order_items 
       WHERE purchase_order_id = $1 AND product_id = $2`,
      [purchaseOrderId, productId]
    );

    const totalAprovado = totalAprovadoResult.rows[0].total_aprovado || 0;

    // Buscar quantidade já usada em pedidos (excluindo cancelados)
    const usadoResult = await pool.query(
      `SELECT COALESCE(SUM(CAST(quantity AS DECIMAL)), 0) as total_usado
       FROM orders 
       WHERE purchase_order_id = $1 AND product_id = $2 AND status != 'Cancelado'`,
      [purchaseOrderId, productId]
    );

    const totalUsado = usadoResult.rows[0].total_usado || 0;

    // Calcular o saldo disponível
    const saldoDisponivel = totalAprovado - totalUsado;

    console.log(`📊 Novo balanço da OC ${purchaseOrderId}, produto ${productId}:`, {
      totalAprovado,
      totalUsado,
      saldoDisponivel
    });
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

  // Settings
  async getSetting(key: string): Promise<Setting | undefined> {
    if (!db) return undefined;
    try {
      const [setting] = await db.select().from(settings).where(eq(settings.key, key));
      return setting || undefined;
    } catch (error) {
      console.error(`Erro ao buscar setting ${key}:`, error);
      return undefined;
    }
  }

  async getAllSettings(): Promise<Setting[]> {
    if (!db) return [];
    try {
      return await db.select().from(settings);
    } catch (error) {
      console.error('Erro ao buscar settings:', error);
      return [];
    }
  }

  async createOrUpdateSetting(insertSetting: InsertSetting): Promise<Setting> {
    if (!db) {
      throw new Error('Database not configured');
    }

    try {
      const existing = await this.getSetting(insertSetting.key);

      if (existing) {
        const [setting] = await db
          .update(settings)
          .set({ value: insertSetting.value, description: insertSetting.description })
          .where(eq(settings.key, insertSetting.key))
          .returning();
        return setting;
      } else {
        const [setting] = await db.insert(settings).values(insertSetting).returning();
        return setting;
      }
    } catch (error) {
      console.error('Erro ao criar/atualizar setting:', error);
      throw error;
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