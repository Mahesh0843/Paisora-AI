declare module 'transaction-sms-parser' {
  export interface Transaction {
    type: 'debit' | 'credit' | null;
    amount: string | null;
    merchant: string | null;
    referenceNo: string | null;
  }
  export interface Account {
    type: string | null;
    name: string | null;
    number: string | null;
  }
  export interface Balance {
    available: string | null;
    outstanding: string | null;
  }
  export interface TransactionInfo {
    account: Account;
    balance: Balance;
    transaction: Transaction;
  }
  export function getTransactionInfo(body: string): TransactionInfo;
}
