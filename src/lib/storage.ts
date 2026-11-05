import { Sale, Student, Installment, CollectionAttempt } from './types';
import * as supabaseStorage from './supabase-storage';

// Re-export Supabase storage functions with compatible interface
export const storage = {
  // Sales
  getSales: async (): Promise<Sale[]> => {
    return await supabaseStorage.getSales();
  },

  saveSale: async (sale: Sale): Promise<void> => {
    await supabaseStorage.saveSale(sale);
  },

  deleteSale: async (id: string): Promise<void> => {
    await supabaseStorage.deleteSale(id);
  },

  // Students
  getStudents: async (): Promise<Student[]> => {
    return await supabaseStorage.getStudents();
  },

  saveStudent: async (student: Student): Promise<void> => {
    await supabaseStorage.saveStudent(student);
  },

  deleteStudent: async (id: string): Promise<void> => {
    await supabaseStorage.deleteStudent(id);
  },

  // Installments
  getInstallments: async (): Promise<Installment[]> => {
    return await supabaseStorage.getInstallments();
  },

  saveInstallment: async (installment: Installment): Promise<void> => {
    await supabaseStorage.saveInstallment(installment);
  },

  saveInstallments: async (newInstallments: Installment[]): Promise<void> => {
    await supabaseStorage.saveInstallments(newInstallments);
  },

  deleteInstallment: async (id: string): Promise<void> => {
    await supabaseStorage.deleteInstallment(id);
  },

  deleteInstallmentsBySale: async (saleId: string): Promise<void> => {
    await supabaseStorage.deleteInstallmentsBySale(saleId);
  },

  // Collection Attempts
  getCollectionAttempts: async (): Promise<CollectionAttempt[]> => {
    return await supabaseStorage.getCollectionAttempts();
  },

  saveCollectionAttempt: async (attempt: CollectionAttempt): Promise<void> => {
    await supabaseStorage.saveCollectionAttempt(attempt);
  },
};
