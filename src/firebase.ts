import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  setDoc, 
  query, 
  where, 
  orderBy
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase App Config from firebase-applet-config.json
const firebaseConfig = {
  projectId: "massive-current-znzsc",
  appId: "1:10128470472:web:acfa8c1e24ada3347e10fd",
  apiKey: "AIzaSyD3fMjy9ECT9vsSju07AEuVdzRtUAISc4A",
  authDomain: "massive-current-znzsc.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-geministudiocomp-9e8e63eb-5541-4415-a048-da0681c727ac",
  storageBucket: "massive-current-znzsc.firebasestorage.app",
  messagingSenderId: "10128470472"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Collection Names
export const COLLECTIONS = {
  CLAIMS: "claims",
  PAYMENTS: "payments",
  DIET_PLANS: "diet_plans",
  USERS: "users",
  NOTIFICATIONS: "notifications",
  HOSPITALS: "hospitals"
};

// === ERROR HANDLING SYSTEM FOR FIRESTORE PERMISSIONS ===
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errMessage = error instanceof Error ? error.message : String(error);
  const isPermissionError = error && (
    (error as any).code === 'permission-denied' ||
    errMessage.toLowerCase().includes("permission") || 
    errMessage.toLowerCase().includes("insufficient")
  );

  if (isPermissionError) {
    const errInfo: FirestoreErrorInfo = {
      error: errMessage,
      authInfo: {
        userId: auth.currentUser?.uid || null,
        email: auth.currentUser?.email || null,
        emailVerified: auth.currentUser?.emailVerified || null,
        isAnonymous: auth.currentUser?.isAnonymous || null,
        tenantId: auth.currentUser?.tenantId || null,
        providerInfo: auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || []
      },
      operationType,
      path
    };
    const stringified = JSON.stringify(errInfo);
    console.error('Firestore Permission Error: ', stringified);
    throw new Error(stringified);
  }
  throw error;
}

// Helper Interfaces (Matching app types)
export interface UserProfile {
  mobileNumber: string;
  userName: string;
  userPlan: string;
  opdLimit: number;
  opdRemaining: number;
  virtualWalletBalance: number;
  joinedAt: string;
}

export interface Claim {
  id: string;
  hospitalName: string;
  doctorName: string;
  billAmount: number;
  claimAmount: number;
  receiptName: string;
  receiptPreview?: string; // Stored as base64 or placeholder URL
  status: 'Pending' | 'Approved' | 'Rejected' | 'Under Review';
  date: string;
  mobileNumber?: string;
}

export interface Payment {
  id: string;
  planName: string;
  amount: number;
  orderId: string;
  paymentId: string;
  date: string;
  mobileNumber?: string;
}

export interface DietPlan {
  id: string;
  age?: string;
  height?: string;
  weight?: string;
  goal: string;
  diabetes?: string;
  bp?: string;
  calories: number;
  meals: {
    breakfast: string;
    lunch: string;
    dinner: string;
    snacks: string;
  };
  date: string;
  mobileNumber?: string;
  dietaryType: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  mobileNumber: string; // Empty string for Broadcasts
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  contact: string;
  city: string;
}

// === FIRESTORE CRUD ACTIONS ===

// 1. Users Actions
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const path = COLLECTIONS.USERS;
  try {
    const userDocRef = doc(db, path, profile.mobileNumber);
    await setDoc(userDocRef, profile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${profile.mobileNumber}`);
  }
}

export async function getUserProfile(mobileNumber: string): Promise<UserProfile | null> {
  const path = COLLECTIONS.USERS;
  try {
    const snap = await getDocs(query(collection(db, path), where("mobileNumber", "==", mobileNumber)));
    if (snap.empty) return null;
    return snap.docs[0].data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const path = COLLECTIONS.USERS;
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(doc => doc.data() as UserProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// 2. Claims Actions
export async function saveClaim(claim: Claim): Promise<void> {
  const path = COLLECTIONS.CLAIMS;
  try {
    const docRef = doc(db, path, claim.id);
    await setDoc(docRef, claim);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${claim.id}`);
  }
}

export async function getClaims(mobileNumber?: string): Promise<Claim[]> {
  const path = COLLECTIONS.CLAIMS;
  try {
    const colRef = collection(db, path);
    let q = query(colRef, orderBy("date", "desc"));
    if (mobileNumber) {
      q = query(colRef, where("mobileNumber", "==", mobileNumber));
    }
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as Claim);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getAllClaims(): Promise<Claim[]> {
  const path = COLLECTIONS.CLAIMS;
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(doc => doc.data() as Claim);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function updateClaimStatus(claimId: string, status: 'Approved' | 'Rejected' | 'Under Review'): Promise<void> {
  const path = COLLECTIONS.CLAIMS;
  try {
    const docRef = doc(db, path, claimId);
    await updateDoc(docRef, { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${claimId}`);
  }
}

// 3. Payments Actions
export async function savePayment(payment: Payment): Promise<void> {
  const path = COLLECTIONS.PAYMENTS;
  try {
    const docRef = doc(db, path, payment.id);
    await setDoc(docRef, payment);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${payment.id}`);
  }
}

export async function getPayments(mobileNumber?: string): Promise<Payment[]> {
  const path = COLLECTIONS.PAYMENTS;
  try {
    const colRef = collection(db, path);
    let q = query(colRef, orderBy("date", "desc"));
    if (mobileNumber) {
      q = query(colRef, where("mobileNumber", "==", mobileNumber));
    }
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as Payment);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function getAllPayments(): Promise<Payment[]> {
  const path = COLLECTIONS.PAYMENTS;
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(doc => doc.data() as Payment);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// 4. Diet Plans Actions
export async function saveDietPlan(dietPlan: DietPlan): Promise<void> {
  const path = COLLECTIONS.DIET_PLANS;
  try {
    const docRef = doc(db, path, dietPlan.id);
    await setDoc(docRef, dietPlan);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${dietPlan.id}`);
  }
}

export async function getDietPlans(mobileNumber?: string): Promise<DietPlan[]> {
  const path = COLLECTIONS.DIET_PLANS;
  try {
    const colRef = collection(db, path);
    let q = query(colRef, orderBy("date", "desc"));
    if (mobileNumber) {
      q = query(colRef, where("mobileNumber", "==", mobileNumber));
    }
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as DietPlan);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// 5. Notifications Actions
export async function saveNotification(notif: AppNotification): Promise<void> {
  const path = COLLECTIONS.NOTIFICATIONS;
  try {
    const docRef = doc(db, path, notif.id);
    await setDoc(docRef, notif);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${notif.id}`);
  }
}

export async function getNotifications(mobileNumber: string): Promise<AppNotification[]> {
  const path = COLLECTIONS.NOTIFICATIONS;
  try {
    const colRef = collection(db, path);
    const snap = await getDocs(query(colRef, orderBy("date", "desc")));
    const allNotifs = snap.docs.map(doc => doc.data() as AppNotification);
    return allNotifs.filter(n => n.mobileNumber === mobileNumber || n.mobileNumber === "");
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// 6. Hospitals Actions
export async function saveHospital(hospital: Hospital): Promise<void> {
  const path = COLLECTIONS.HOSPITALS;
  try {
    const docRef = doc(db, path, hospital.id);
    await setDoc(docRef, hospital);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${hospital.id}`);
  }
}

export async function getHospitals(): Promise<Hospital[]> {
  const path = COLLECTIONS.HOSPITALS;
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map(doc => doc.data() as Hospital);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}
