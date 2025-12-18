// Initialize production system - no demo accounts
// In production, all accounts must be created by admin user

export const initializeDefaults = async () => {
  try {
    console.log('⚠️ Production mode: Demo accounts are DISABLED');
    console.log('📝 To create admin account, use Firebase Console directly');
    return true;
  } catch (error) {
    console.error('❌ Error in initializeDefaults:', error);
    return false;
  }
};

export default initializeDefaults;
