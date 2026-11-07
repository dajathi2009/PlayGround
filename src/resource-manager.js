import { SUN_CONFIG } from "./sun-config.js";

/** The single authority for the player's sun balance and resource accounting. */
export class ResourceManager {
  constructor(initialBalance = SUN_CONFIG.startingBalance) {
    this.initialBalance = Math.max(0, Math.floor(initialBalance));
    this.balance = this.initialBalance;
    this.totalEarned = 0;
    this.totalSpent = 0;
    this.listeners = new Set();
  }

  getBalance() { return this.balance; }
  canAfford(amount) {
    return Number.isFinite(amount) && amount >= 0 && this.balance >= amount;
  }
  canBuyPlant(cost) { return this.canAfford(cost); }
  subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  notify(change) {
    for (const listener of this.listeners) listener({ ...change, balance: this.balance, totalEarned: this.totalEarned, totalSpent: this.totalSpent });
  }
  add(amount, reason = "collect") {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    const value = Math.floor(amount);
    if (!value) return false;
    this.balance += value;
    this.totalEarned += value;
    this.notify({ type: "add", amount: value, reason });
    return true;
  }
  spend(amount, reason = "purchase") {
    if (!Number.isFinite(amount) || amount <= 0 || !this.canAfford(amount)) return false;
    const value = Math.floor(amount);
    if (!value || !this.canAfford(value)) return false;
    this.balance -= value;
    this.totalSpent += value;
    this.notify({ type: "spend", amount: value, reason });
    return true;
  }
  reset(initialBalance = this.initialBalance) {
    this.initialBalance = Math.max(0, Math.floor(initialBalance));
    this.balance = this.initialBalance;
    this.totalEarned = 0;
    this.totalSpent = 0;
    this.notify({ type: "reset", amount: 0, reason: "reset" });
  }
  /** Keep the HUD contract in one place; the canvas HUD subscribes to this event. */
  updateCounter() { this.notify({ type: "refresh", amount: 0, reason: "refresh" }); }
}
