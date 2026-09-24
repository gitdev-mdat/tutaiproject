import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { OrderStatus, PaymentMethod, PlusOrder, PlusSubscription } from './payment-types';

const DATA_DIR = path.join(process.cwd(), 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'mock-orders.json');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'mock-subscriptions.json');

// Ensure files exist
function ensureDBFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(SUBSCRIPTIONS_FILE)) {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify([]));
  }
}

// Generate a random but readable order code, e.g., TT-A7K2P9
function generateOrderCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TT-${code}`;
}

// --- Orders ---

export async function getOrders(): Promise<PlusOrder[]> {
  ensureDBFiles();
  const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
  return JSON.parse(data);
}

export async function getAllOrders(): Promise<PlusOrder[]> {
  const orders = await getOrders();
  // Sort newest first
  return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function saveOrders(orders: PlusOrder[]): Promise<void> {
  ensureDBFiles();
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

export async function createOrder(
  userId: string,
  planId: string,
  amount: number,
  paymentMethod: PaymentMethod
): Promise<PlusOrder> {
  const orders = await getOrders();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // Expires in 30 mins

  const order: PlusOrder = {
    id: uuidv4(),
    code: generateOrderCode(),
    userId,
    planId,
    amount,
    currency: 'VND',
    paymentMethod,
    status: 'PENDING_PAYMENT',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  orders.push(order);
  await saveOrders(orders);
  return order;
}

export async function getOrderByCode(code: string): Promise<PlusOrder | null> {
  const orders = await getOrders();
  return orders.find((o) => o.code === code) || null;
}

export async function getOrdersByUserId(userId: string): Promise<PlusOrder[]> {
  const orders = await getOrders();
  // Sort newest first
  return orders
    .filter((o) => o.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function updateOrderStatus(
  code: string,
  status: OrderStatus,
  updates: Partial<PlusOrder> = {}
): Promise<PlusOrder> {
  const orders = await getOrders();
  const index = orders.findIndex((o) => o.code === code);
  if (index === -1) throw new Error('Order not found');

  const updatedOrder = { ...orders[index], status, ...updates };
  orders[index] = updatedOrder;
  await saveOrders(orders);
  return updatedOrder;
}

// --- Subscriptions ---

export async function getSubscriptions(): Promise<PlusSubscription[]> {
  ensureDBFiles();
  const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8');
  return JSON.parse(data);
}

export async function saveSubscriptions(subscriptions: PlusSubscription[]): Promise<void> {
  ensureDBFiles();
  fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2));
}

export async function getSubscriptionByUserId(userId: string): Promise<PlusSubscription | null> {
  const subscriptions = await getSubscriptions();
  return subscriptions.find((s) => s.userId === userId) || null;
}

export async function upsertSubscription(sub: PlusSubscription): Promise<PlusSubscription> {
  const subscriptions = await getSubscriptions();
  const index = subscriptions.findIndex((s) => s.userId === sub.userId);
  if (index === -1) {
    subscriptions.push(sub);
  } else {
    subscriptions[index] = sub;
  }
  await saveSubscriptions(subscriptions);
  return sub;
}
