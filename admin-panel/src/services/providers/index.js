/**
 * PROVIDER ABSTRACTION LAYER
 * 
 * This layer abstracts backend services (Firebase, AWS, etc.)
 * allowing easy migration without changing component code.
 * 
 * CURRENT: Firebase
 * FUTURE: AWS (Cognito, DynamoDB, S3)
 */

// Import Firebase implementations
import FirebaseAuthProvider from './firebase/FirebaseAuthProvider';
import FirebaseDatabaseProvider from './firebase/FirebaseDatabaseProvider';
import FirebaseStorageProvider from './firebase/FirebaseStorageProvider';

/**
 * Service Provider Configuration
 * Change these to swap backends
 */
export const PROVIDERS = {
  // CURRENT BACKEND: Firebase
  auth: new FirebaseAuthProvider(),
  database: new FirebaseDatabaseProvider(),
  storage: new FirebaseStorageProvider(),

  // FUTURE: AWS Backend (uncomment after AWS migration)
  // auth: new AWSCognitoAuthProvider(),
  // database: new AWSDynamoDBProvider(),
  // storage: new AWSS3StorageProvider(),
};

export default PROVIDERS;
