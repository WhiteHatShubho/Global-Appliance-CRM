import { getDatabase, ref, remove } from 'firebase/database';

/**
 * Cleanup utility to delete all data from Firebase
 * WARNING: This is a destructive operation and cannot be undone!
 */

const deleteAllData = async (firebaseApp) => {
  try {
    const database = getDatabase(firebaseApp);
    
    console.log('Starting data cleanup...');
    
    // Delete all customers
    console.log('Deleting all customers...');
    await remove(ref(database, 'customers'));
    
    // Delete all tickets/jobs
    console.log('Deleting all tickets/jobs...');
    await remove(ref(database, 'tickets'));
    
    // Delete all payments
    console.log('Deleting all payments...');
    await remove(ref(database, 'payments'));
    
    // Delete all job history
    console.log('Deleting all job history...');
    await remove(ref(database, 'jobHistory'));
    
    // Delete all payment history
    console.log('Deleting all payment history...');
    await remove(ref(database, 'paymentHistory'));
    
    // Delete all call logs
    console.log('Deleting all call logs...');
    await remove(ref(database, 'callLogs'));
    
    console.log('✅ All data deleted successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error deleting data:', error);
    throw error;
  }
};

/**
 * Delete only customers and their related data
 */
const deleteAllCustomers = async (firebaseApp) => {
  try {
    const database = getDatabase(firebaseApp);
    
    console.log('Deleting all customers...');
    await remove(ref(database, 'customers'));
    
    console.log('✅ All customers deleted successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error deleting customers:', error);
    throw error;
  }
};

/**
 * Delete only tickets/jobs
 */
const deleteAllTickets = async (firebaseApp) => {
  try {
    const database = getDatabase(firebaseApp);
    
    console.log('Deleting all tickets/jobs...');
    await remove(ref(database, 'tickets'));
    
    console.log('✅ All tickets/jobs deleted successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error deleting tickets:', error);
    throw error;
  }
};

/**
 * Delete only payments and payment history
 */
const deleteAllPayments = async (firebaseApp) => {
  try {
    const database = getDatabase(firebaseApp);
    
    console.log('Deleting all payments...');
    await remove(ref(database, 'payments'));
    
    console.log('Deleting all payment history...');
    await remove(ref(database, 'paymentHistory'));
    
    console.log('✅ All payments deleted successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error deleting payments:', error);
    throw error;
  }
};

export { deleteAllData, deleteAllCustomers, deleteAllTickets, deleteAllPayments };
