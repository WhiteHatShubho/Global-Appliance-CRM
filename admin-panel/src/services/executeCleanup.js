import { getDatabase, ref, remove } from 'firebase/database';
import auditService from './auditService';

/**
 * Execute immediate cleanup of all demo data
 * SECURITY: This function is disabled in production
 */
export const executeImmediateCleanup = async (firebaseApp) => {
  // Disable in production
  if (process.env.NODE_ENV === 'production') {
    console.warn('⚠️ SECURITY: Cleanup function is disabled in production environment');
    return { 
      success: false, 
      message: 'Cleanup function is not available in production environment' 
    };
  }

  // Double confirmation required
  const confirmMessage = 'Are you sure you want to DELETE ALL DATA? This cannot be undone!';
  if (!window.confirm(confirmMessage)) {
    return { success: false, message: 'Cleanup cancelled by user' };
  }

  const finalConfirm = 'This is your FINAL WARNING. All data will be PERMANENTLY deleted. Type YES to confirm:';
  const userConfirm = prompt(finalConfirm);
  if (userConfirm !== 'YES') {
    return { success: false, message: 'Cleanup cancelled - confirmation not provided' };
  }

  try {
    const database = getDatabase(firebaseApp);
    
    console.log('🗑️ Starting immediate data cleanup...');
    
    // Log the bulk cleanup
    const pathsToDelete = [
      'customers',
      'tickets',
      'payments',
      'jobHistory',
      'paymentHistory',
      'callLogs',
      'technicians'
    ];
    
    await auditService.logBulkCleanup(pathsToDelete);

    for (const path of pathsToDelete) {
      try {
        console.log(`Deleting ${path}...`);
        await remove(ref(database, path));
        console.log(`✅ ${path} deleted`);
      } catch (err) {
        console.warn(`⚠️ Could not delete ${path}:`, err.message);
      }
    }

    console.log('✅ All demo data cleaned up successfully!');
    return { success: true, message: 'All demo data has been deleted!' };
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return { success: false, message: error.message };
  }
};
