/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { motion } from 'motion/react';
import {
  Smartphone,
  Database,
  FolderTree,
  ChevronRight,
  ChevronDown,
  FileCode,
  Copy,
  Check,
  Send,
  Sparkles,
  ArrowRight,
  Wifi,
  Battery,
  Shield,
  Clock,
  User,
  CreditCard,
  Heart,
  Plus,
  RefreshCw,
  Search,
  CheckCircle,
  FileText,
  DollarSign,
  Calendar,
  Layers,
  MapPin,
  ArrowLeft,
  X,
  FilePlus,
  Compass,
  Bell,
  Inbox,
  AlertCircle,
  ListOrdered,
  History as HistoryIcon,
  ShieldCheck,
  Trash2,
  Lock,
  MessageSquare,
  QrCode,
  Scan,
  Zap,
  ZapOff,
  Loader2,
  Camera
} from 'lucide-react';
import { sqlTables } from './data/sqlSchema';
import { flutterFiles } from './data/flutterStructure';
import { estimateTokens, calculateCost, formatUsd } from './utils/tokenCalculator';
import { exportToMarkdown, exportToPdf } from './utils/exporter';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  saveUserProfile,
  getUserProfile,
  getAllUsers,
  saveClaim,
  getClaims,
  getAllClaims,
  updateClaimStatus,
  savePayment,
  getPayments,
  getAllPayments,
  saveDietPlan,
  getDietPlans,
  saveNotification,
  getNotifications,
  saveHospital,
  getHospitals
} from './firebase';

// Type definitions
interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface Claim {
  id: string;
  hospitalName: string;
  doctorName: string;
  billAmount: number;
  claimAmount: number;
  receiptName: string;
  receiptPreview?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Under Review';
  date: string;
  mobileNumber?: string;
}

interface Hospital {
  id: string;
  name: string;
  address: string;
  contact: string;
  city: string;
}

interface Payment {
  id: string;
  planName: string;
  amount: number;
  orderId: string;
  paymentId: string;
  date: string;
  mobileNumber?: string;
}

interface DietPlan {
  id: string;
  goal: string;
  dietaryType: string;
  calories: number;
  meals: {
    breakfast: string;
    lunch: string;
    dinner: string;
    snacks: string;
  };
  date: string;
  age?: string;
  height?: string;
  weight?: string;
  diabetes?: string;
  bp?: string;
  mobileNumber?: string;
}

// ----------------------------------------------------------------------------
// HIGH-PERFORMANCE COMPUTER VISION UTILITIES FOR DOCUMENT OCR prep
// ----------------------------------------------------------------------------

/**
 * Detects the document skew/tilt angle using horizontal projection profile variance.
 * Text rows and straight paper edges produce extremely high-variance peak structures 
 * in projection profiles when perfectly aligned.
 */
function detectSkewAngle(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  // 1. Convert to high-contrast Grayscale
  const gray = new Float32Array(width * height);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // 2. Sobel Edge Gradient Filter to isolate strong lines and printed text rows
  const edges = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx = 
        - gray[idx - width - 1] + gray[idx - width + 1]
        - 2 * gray[idx - 1] + 2 * gray[idx + 1]
        - gray[idx + width - 1] + gray[idx + width + 1];
      const gy = 
        - gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1]
        + gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];
      edges[idx] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // 3. Scan potential rotation angles for the maximum projection profile variance
  let bestAngle = 0;
  let maxVariance = -1;

  const anglesToTest: number[] = [];
  // Fine resolution search from -15 to +15 degrees with 0.5 degree steps
  for (let a = -15; a <= 15; a += 0.5) {
    anglesToTest.push(a);
  }

  const midX = width / 2;
  const midY = height / 2;

  for (const angle of anglesToTest) {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const binsCount = Math.ceil(width * Math.abs(sin) + height * Math.abs(cos));
    const bins = new Float32Array(binsCount);

    // Accumulate edge intensities in rotated coordinates
    for (let y = 6; y < height - 6; y += 3) {
      for (let x = 6; x < width - 6; x += 3) {
        const val = edges[y * width + x];
        if (val > 35) { // Isolate prominent edges/text
          const ry = -(x - midX) * sin + (y - midY) * cos;
          const binIdx = Math.floor(ry + binsCount / 2);
          if (binIdx >= 0 && binIdx < binsCount) {
            bins[binIdx] += val;
          }
        }
      }
    }

    // Calculate variance of the horizontal projection bins
    let sum = 0;
    let sqSum = 0;
    let count = 0;
    for (let i = 0; i < binsCount; i++) {
      if (bins[i] > 0) {
        sum += bins[i];
        sqSum += bins[i] * bins[i];
        count++;
      }
    }

    if (count > 0) {
      const mean = sum / count;
      const variance = (sqSum / count) - (mean * mean);
      if (variance > maxVariance) {
        maxVariance = variance;
        bestAngle = angle;
      }
    }
  }

  return bestAngle;
}

/**
 * Heuristically detects receipt bounds by looking for high gradient contrasts
 * and luminance deviations (white paper against darker surface background).
 */
function detectDocumentEdges(canvas: HTMLCanvasElement): { x: number; y: number; width: number; height: number } | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  let sumLuma = 0;
  const luma = new Float32Array(width * height);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    luma[i / 4] = l;
    sumLuma += l;
  }
  const avgLuma = sumLuma / (width * height);

  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;

  for (let y = 8; y < height - 8; y += 2) {
    for (let x = 8; x < width - 8; x += 2) {
      const idx = y * width + x;
      const gx = luma[idx + 1] - luma[idx - 1];
      const gy = luma[idx + width] - luma[idx - width];
      const grad = Math.sqrt(gx * gx + gy * gy);
      
      // Look for edges or bright receipt paper
      if (grad > 20 || Math.abs(luma[idx] - avgLuma) > 25) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX >= maxX || minY >= maxY) {
    return null;
  }

  // Inject small safety padding bounds so text isn't cut off
  minX = Math.max(5, minX - 10);
  minY = Math.max(5, minY - 10);
  maxX = Math.min(width - 5, maxX + 10);
  maxY = Math.min(height - 5, maxY + 10);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

export default function App() {
  // Global Workspace Tabs
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'simulator' | 'database' | 'flutter' | 'admin' | 'publishing'>('simulator');
  const [apiStatus, setApiStatus] = useState<{ checked: boolean; healthy: boolean; message: string }>({
    checked: false,
    healthy: false,
    message: 'Checking endpoint health...'
  });

  // App Notifications Sync
  const [appNotifications, setAppNotifications] = useState<any[]>([
    { id: 'NOT-1', title: 'Welcome to Gemini Care', message: 'Unlock cashless OPD refunds up to ₹5,000 instantly by upgrading your policy.', date: '2026-07-01', read: false }
  ]);

  // Diet Health Metrics
  const [dietHeight, setDietHeight] = useState<string>('170');
  const [dietDiabetes, setDietDiabetes] = useState<string>('No'); // 'No' | 'Type 1' | 'Type 2' | 'Pre-Diabetic'
  const [dietBP, setDietBP] = useState<string>('No'); // 'No' | 'High' | 'Low'

  // Admin Broadcast States
  const [adminNotifRecipient, setAdminNotifRecipient] = useState<string>('all'); // 'all' or mobile number
  const [adminNotifTitle, setAdminNotifTitle] = useState<string>('');
  const [adminNotifMessage, setAdminNotifMessage] = useState<string>('');
  const [adminNotifSuccess, setAdminNotifSuccess] = useState<string | null>(null);

  // Firestore Sync Lists
  const [allUsersDb, setAllUsersDb] = useState<any[]>([]);
  const [allPaymentsDb, setAllPaymentsDb] = useState<any[]>([]);
  const [allClaimsDb, setAllClaimsDb] = useState<any[]>([]);

  // Claim Date Selection
  const [claimDate, setClaimDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Google Play Console selected document type
  const [selectedDocType, setSelectedDocType] = useState<'privacy' | 'terms'>('privacy');

  // Copied item indicator
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active Simulated Screen: 'splash' | 'login' | 'home' | 'plans' | 'wallet' | 'chat' | 'diet' | 'profile' | 'claim' | 'history' | 'admin'
  const [simScreen, setSimScreen] = useState<string>('splash');

  // Claim Submission Confirmation details
  const [submittedClaim, setSubmittedClaim] = useState<Claim | null>(null);

  // Admin Batch Selection State
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);
  
  // Simulation Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [mobileNumber, setMobileNumber] = useState<string>('9876543210');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Simulation Profile State
  const [userName, setUserName] = useState<string>('Sumit Sharma');
  const [userPlan, setUserPlan] = useState<string>('None'); // 'None' | 'Bronze Starter' | 'Silver Regular' | 'Gold Max Pro'
  const [opdLimit, setOpdLimit] = useState<number>(0);
  const [opdRemaining, setOpdRemaining] = useState<number>(0);
  const [virtualWalletBalance, setVirtualWalletBalance] = useState<number>(0.00);

  // Simulated Database Registries
  const [hospitals, setHospitals] = useState<Hospital[]>([
    { id: '1', name: 'Apollo Hospitals', address: 'Greams Road, Thousand Lights', contact: '+91 44 2829 0200', city: 'Chennai' },
    { id: '2', name: 'Fortis Memorial Research Institute', address: 'Sector 44, Opposite HUDA City Centre', contact: '+91 124 496 2200', city: 'Gurugram' },
    { id: '3', name: 'Max Super Speciality Hospital', address: '1, 2, Press Enclave Road, Saket', contact: '+91 11 2651 5050', city: 'New Delhi' },
    { id: '4', name: 'Kokilaben Dhirubhai Ambani Hospital', address: 'Rao Saheb, Achutrao Patwardhan Marg, Four Bungalows', contact: '+91 22 4269 6969', city: 'Mumbai' }
  ]);

  const [claims, setClaims] = useState<Claim[]>([
    { id: 'CLM-8192', hospitalName: 'Apollo Hospitals', doctorName: 'Dr. Ramesh Nair (Cardiologist)', billAmount: 1850.00, claimAmount: 1850.00, receiptName: 'apollo_opd_bill_029.png', status: 'Approved', date: '2026-06-15' },
    { id: 'CLM-9031', hospitalName: 'Max Super Speciality Hospital', doctorName: 'Dr. Anita Desai (Pediatrician)', billAmount: 1200.00, claimAmount: 1200.00, receiptName: 'max_invoice_4910.jpg', status: 'Pending', date: '2026-07-02' }
  ]);

  const [payments, setPayments] = useState<Payment[]>([
    { id: 'PAY-4029', planName: 'Silver Regular', amount: 99.00, orderId: 'order_SVR_491039', paymentId: 'pay_SVR_491039829', date: '2026-06-10' }
  ]);

  const [dietPlans, setDietPlans] = useState<DietPlan[]>([
    {
      id: 'DIET-102',
      goal: 'Weight Loss',
      dietaryType: 'Vegetarian',
      calories: 1800,
      meals: {
        breakfast: 'Oatmeal with chia seeds, banana slices, and a handful of almonds.',
        lunch: 'Quinoa stir-fry with mixed vegetables, grilled paneer, and sprout salad.',
        dinner: 'Lentil soup (Moong dal) with boiled spinach and two whole wheat rotis.',
        snacks: 'Roasted makhana (foxnuts) and a cup of green tea.'
      },
      date: '2026-06-28'
    }
  ]);

  // Razorpay Checkout Modal Simulator States
  const [razorpayOpen, setRazorpayOpen] = useState<boolean>(false);
  const [razorpayPlan, setRazorpayPlan] = useState<{ name: string; price: number; claims: number } | null>(null);
  const [razorpayStep, setRazorpayStep] = useState<'details' | 'processing' | 'success'>('details');
  const [rzpCardNumber, setRzpCardNumber] = useState<string>('4111 1111 1111 1111');
  const [rzpExpiry, setRzpExpiry] = useState<string>('12/29');
  const [rzpCvv, setRzpCvv] = useState<string>('123');

  // OPD Claim Submission States
  const [claimHospital, setClaimHospital] = useState<string>('1');
  const [claimDoctor, setClaimDoctor] = useState<string>('');
  const [claimBillAmount, setClaimBillAmount] = useState<string>('');
  const [claimReceipt, setClaimReceipt] = useState<File | null>(null);
  const [claimReceiptName, setClaimReceiptName] = useState<string>('');
  const [claimReceiptPreview, setClaimReceiptPreview] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Cropping, Rotation & Pinch Zoom States for OPD Receipt upload
  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false);
  const [cropSourceImage, setCropSourceImage] = useState<string | null>(null);
  const [cropSourceFileName, setCropSourceFileName] = useState<string>('');
  const [cropZoom, setCropZoom] = useState<number>(1);
  const [cropRotation, setCropRotation] = useState<number>(0);
  const [cropTranslate, setCropTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [imageDimensions, setImageDimensions] = useState({
    naturalWidth: 0,
    naturalHeight: 0,
    displayWidth: 0,
    displayHeight: 0
  });

  const dragStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });
  const touchStartDist = useRef<number | null>(null);
  const zoomStartVal = useRef<number>(1);
  const imgRef = useRef<HTMLImageElement>(null);

  // Free crop, edge detection & auto-enhance states
  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({ x: 30, y: 30, width: 220, height: 280 });
  const [draggedHandle, setDraggedHandle] = useState<'nw' | 'ne' | 'sw' | 'se' | 'none'>('none');
  const [isEnhanced, setIsEnhanced] = useState<boolean>(true); // Default to true for crisp text OCR
  const [isFreeCrop, setIsFreeCrop] = useState<boolean>(false);
  const [autoStraightenedAngle, setAutoStraightenedAngle] = useState<number | null>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);

  // QR Code Scanner State
  const [qrScannerOpen, setQrScannerOpen] = useState<boolean>(false);
  const [qrScannerTab, setQrScannerTab] = useState<'camera' | 'upload'>('camera');
  const [qrScannerError, setQrScannerError] = useState<string | null>(null);
  const [qrScannerSuccess, setQrScannerSuccess] = useState<string | null>(null);
  const [qrIsScanning, setQrIsScanning] = useState<boolean>(false);
  const [flashOn, setFlashOn] = useState<boolean>(false);
  const [hasFlash, setHasFlash] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const qrInstanceRef = useRef<Html5Qrcode | null>(null);

  // Admin QR Code Generator state
  const [selectedQrHospital, setSelectedQrHospital] = useState<Hospital | null>(null);
  const [qrPreFillDoctor, setQrPreFillDoctor] = useState<string>('');
  const [qrPreFillAmount, setQrPreFillAmount] = useState<string>('');
  const [qrPreFillDate, setQrPreFillDate] = useState<string>('');

  // History Claim Receipt Preview state
  const [previewClaim, setPreviewClaim] = useState<Claim | null>(null);
  const [historyPreviewZoom, setHistoryPreviewZoom] = useState<number>(1);
  const [historyPreviewTranslate, setHistoryPreviewTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingHistory, setIsDraggingHistory] = useState<boolean>(false);
  const dragStartHistory = useRef({ x: 0, y: 0 });
  const translateStartHistory = useRef({ x: 0, y: 0 });

  const handleMouseDownHistory = (e: React.MouseEvent<HTMLDivElement>) => {
    if (historyPreviewZoom <= 1) return;
    e.preventDefault();
    setIsDraggingHistory(true);
    dragStartHistory.current = { x: e.clientX, y: e.clientY };
    translateStartHistory.current = { ...historyPreviewTranslate };
  };

  const handleMouseMoveHistory = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingHistory) return;
    const dx = e.clientX - dragStartHistory.current.x;
    const dy = e.clientY - dragStartHistory.current.y;
    setHistoryPreviewTranslate({
      x: translateStartHistory.current.x + dx,
      y: translateStartHistory.current.y + dy
    });
  };

  const handleMouseUpHistory = () => {
    setIsDraggingHistory(false);
  };

  // Helper helper to parse scanned texts (JSON or plain key-values)
  const parseQrCodeText = (text: string) => {
    try {
      const data = JSON.parse(text);
      if (data && typeof data === 'object') {
        return {
          hospitalId: data.hospitalId || data.facilityId || undefined,
          doctorName: data.doctorName || data.doctor || undefined,
          billAmount: data.billAmount || data.amount || undefined,
          date: data.date || undefined
        };
      }
    } catch (e) {
      const result: any = {};
      const lines = text.split(/[\n,;]+/);
      for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const key = parts[0].trim().toLowerCase();
          const value = parts.slice(1).join(':').trim();
          if (key.includes('hospital') || key.includes('facility')) {
            result.hospitalId = value;
          } else if (key.includes('doctor') || key.includes('dr')) {
            result.doctorName = value;
          } else if (key.includes('bill') || key.includes('amount')) {
            const num = parseFloat(value.replace(/[^0-9.]/g, ''));
            if (!isNaN(num)) {
              result.billAmount = num;
            }
          } else if (key.includes('date')) {
            result.date = value;
          }
        }
      }
      if (result.hospitalId || result.doctorName || result.billAmount) {
        return result;
      }
    }
    return null;
  };

  const handleScannedResult = async (decodedText: string) => {
    const data = parseQrCodeText(decodedText);
    if (data) {
      if (data.hospitalId) {
        const found = hospitals.find(h => h.id === data.hospitalId || h.name.toLowerCase().includes(data.hospitalId.toLowerCase()));
        if (found) {
          setClaimHospital(found.id);
        }
      }
      if (data.doctorName) {
        setClaimDoctor(data.doctorName);
      }
      if (data.billAmount) {
        setClaimBillAmount(String(data.billAmount));
      }
      if (data.date) {
        setClaimDate(data.date);
      }
      
      // Auto-capture camera snapshot if active
      try {
        const container = document.getElementById("qr-scanner-view");
        const videoEl = container?.querySelector('video') as HTMLVideoElement | null;
        if (videoEl) {
          const canvas = document.createElement('canvas');
          canvas.width = videoEl.videoWidth || 640;
          canvas.height = videoEl.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg");
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], `scanned_qr_receipt_${Math.floor(1000 + Math.random()*9000)}.jpg`, { type: "image/jpeg" });
            
            setClaimReceipt(file);
            setClaimReceiptName(file.name);
            setClaimReceiptPreview(dataUrl);
          }
        }
      } catch (e) {
        console.warn("Could not auto-capture frame during QR success:", e);
      }

      setQrScannerSuccess("QR Code parsed successfully! Auto-filled details and attached receipt snapshot.");
      setQrScannerError(null);
      
      setTimeout(() => {
        setQrScannerOpen(false);
        setQrScannerSuccess(null);
      }, 1500);
      
      stopQrCamera();
    } else {
      setQrScannerError("QR code detected, but its content format is unrecognized. Please scan a valid empanelled receipt QR.");
    }
  };

  const startQrCamera = async () => {
    try {
      setQrScannerError(null);
      setQrScannerSuccess(null);
      setFlashOn(false);
      setHasFlash(false);
      
      if (qrInstanceRef.current) {
        try {
          await qrInstanceRef.current.stop();
        } catch (e) {
          // ignore
        }
        qrInstanceRef.current = null;
      }

      const container = document.getElementById("qr-scanner-view");
      if (!container) return;

      const html5QrCode = new Html5Qrcode("qr-scanner-view");
      qrInstanceRef.current = html5QrCode;
      setQrIsScanning(true);

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (width, height) => {
            const minSize = Math.min(width, height);
            const boxSize = Math.floor(minSize * 0.7);
            return { width: boxSize, height: boxSize };
          }
        },
        (decodedText) => {
          handleScannedResult(decodedText);
        },
        () => {
          // silent frame-rate errors
        }
      );

      // Verify and set auto-focus constraints + flash toggle support after starting camera
      setTimeout(() => {
        try {
          const videoEl = container.querySelector('video') as HTMLVideoElement | null;
          if (videoEl && videoEl.srcObject) {
            const stream = videoEl.srcObject as MediaStream;
            const track = stream.getVideoTracks()[0];
            if (track) {
              const capabilities = typeof track.getCapabilities === 'function' ? track.getCapabilities() : {};
              setHasFlash(!!(capabilities as any).torch);
              
              if (typeof track.applyConstraints === 'function') {
                track.applyConstraints({
                  advanced: [{ focusMode: 'continuous' } as any]
                }).catch(err => console.warn("Could not set continuous focus constraint:", err));
              }
            }
          }
        } catch (e) {
          console.warn("Failed checking track capabilities:", e);
        }
      }, 600);

    } catch (err: any) {
      console.warn("Failed to start QR camera:", err);
      setQrIsScanning(false);
      setQrScannerError(
        "Camera access failed. Ensure you are on HTTPS, camera permission is enabled, or use the 'Upload QR Image' tab."
      );
    }
  };

  const stopQrCamera = async () => {
    if (qrInstanceRef.current) {
      try {
        if (qrInstanceRef.current.isScanning) {
          await qrInstanceRef.current.stop();
        }
      } catch (e) {
        console.warn("Failed to stop QR camera:", e);
      }
      qrInstanceRef.current = null;
    }
    setQrIsScanning(false);
    setFlashOn(false);
    setHasFlash(false);
  };

  const toggleFlash = async () => {
    try {
      const container = document.getElementById("qr-scanner-view");
      const videoEl = container?.querySelector('video') as HTMLVideoElement | null;
      if (!videoEl || !videoEl.srcObject) {
        console.warn("No active video stream found for torch.");
        return;
      }
      const stream = videoEl.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      if (!track) return;

      const nextFlashState = !flashOn;
      if (typeof track.applyConstraints === 'function') {
        await track.applyConstraints({
          advanced: [{ torch: nextFlashState } as any]
        });
      }
      setFlashOn(nextFlashState);
    } catch (err) {
      console.warn("Torch constraint application failed:", err);
      // Fallback toggling for simulator representation
      setFlashOn(prev => !prev);
    }
  };

  const triggerAutoCapture = async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    try {
      const container = document.getElementById("qr-scanner-view");
      const videoEl = container?.querySelector('video') as HTMLVideoElement | null;
      
      if (videoEl) {
        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth || 640;
        canvas.height = videoEl.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg");
          
          const response = await fetch(dataUrl);
          const blob = await response.blob();
          const file = new File([blob], `captured_receipt_${Math.floor(1000 + Math.random()*9000)}.jpg`, { type: "image/jpeg" });
          
          setClaimReceipt(file);
          setClaimReceiptName(file.name);
          setClaimReceiptPreview(dataUrl);
        }
      }

      // Pre-fill realistic, high-quality empanelled details if form is empty
      if (!claimDoctor) {
        setClaimHospital("1"); // Apollo Hospitals
        setClaimDoctor("Dr. Ramesh Nair (Cardiologist)");
        setClaimBillAmount("1850");
        setClaimDate(new Date().toISOString().split('T')[0]);
      }

      setQrScannerSuccess("OPD Receipt captured automatically! High-fidelity snapshot attached.");
      setQrScannerError(null);

      // Audio shutter click synthesis
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.stop(audioCtx.currentTime + 0.15);
      } catch (e) {
        // audio context blocked
      }

      setTimeout(() => {
        setQrScannerOpen(false);
        setQrScannerSuccess(null);
        setIsCapturing(false);
      }, 1500);

      stopQrCamera();
    } catch (err) {
      console.error("Auto-capture processing failed:", err);
      setIsCapturing(false);
    }
  };

  const handleQrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setQrScannerError(null);
      setQrScannerSuccess(null);

      try {
        const dummyDiv = document.createElement('div');
        dummyDiv.id = 'qr-dummy-element';
        dummyDiv.style.display = 'none';
        document.body.appendChild(dummyDiv);

        const html5QrCode = new Html5Qrcode("qr-dummy-element");
        const decodedText = await html5QrCode.scanFile(file, false);
        document.body.removeChild(dummyDiv);
        handleScannedResult(decodedText);
      } catch (err: any) {
        console.error("QR Code image parsing error:", err);
        setQrScannerError("Failed to detect QR code in this image. Please make sure the QR code is clear, well-lit, and uncropped.");
        const dummy = document.getElementById('qr-dummy-element');
        if (dummy) {
          document.body.removeChild(dummy);
        }
      }
    }
  };

  useEffect(() => {
    if (qrScannerOpen && qrScannerTab === 'camera') {
      const timer = setTimeout(() => {
        startQrCamera();
      }, 150);
      return () => {
        clearTimeout(timer);
        stopQrCamera();
      };
    } else {
      stopQrCamera();
    }
  }, [qrScannerOpen, qrScannerTab]);

  useEffect(() => {
    let interval: any;
    if (qrScannerOpen && qrScannerTab === 'camera' && qrIsScanning) {
      setScanProgress(0);
      interval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            triggerAutoCapture();
            return 100;
          }
          return prev + 10;
        });
      }, 200);
    } else {
      setScanProgress(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [qrScannerOpen, qrScannerTab, qrIsScanning]);

  // AI Chat Assistant States (using real-time server-side Gemini endpoints)
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am your clinical AI Health assistant. You can ask me about health concerns, OPD claim details, or wellness guidelines. How can I help you today?', timestamp: '12:00 PM' }
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Diet Plan Generation States
  const [dietGoal, setDietGoal] = useState<string>('Weight Loss');
  const [dietType, setDietType] = useState<string>('Vegetarian');
  const [dietWeight, setDietWeight] = useState<string>('72');
  const [dietAge, setDietAge] = useState<string>('28');
  const [dietLoading, setDietLoading] = useState<boolean>(false);
  const [generatedDiet, setGeneratedDiet] = useState<DietPlan | null>(null);

  // Database Explorer Filter
  const [activeDbTable, setActiveDbTable] = useState<string>('users');

  // Flutter Code Explorer Navigation Tree
  const [selectedFlutterFile, setSelectedFlutterFile] = useState<string>('lib/main.dart');

  // Admin Portal state
  const [newHospitalName, setNewHospitalName] = useState<string>('');
  const [newHospitalAddress, setNewHospitalAddress] = useState<string>('');
  const [newHospitalContact, setNewHospitalContact] = useState<string>('');
  const [newHospitalCity, setNewHospitalCity] = useState<string>('');

  // Admin Real-Time Search States
  const [searchUser, setSearchUser] = useState<string>('');
  const [searchClaim, setSearchClaim] = useState<string>('');
  const [searchHospital, setSearchHospital] = useState<string>('');
  const [searchPayment, setSearchPayment] = useState<string>('');

  // Admin Table Sorting States
  const [claimsSortField, setClaimsSortField] = useState<'date' | 'status' | 'amount' | 'user'>('date');
  const [claimsSortDirection, setClaimsSortDirection] = useState<'asc' | 'desc'>('desc');

  const [usersSortField, setUsersSortField] = useState<'name' | 'mobile' | 'balance'>('name');
  const [usersSortDirection, setUsersSortDirection] = useState<'asc' | 'desc'>('asc');

  const [paymentsSortField, setPaymentsSortField] = useState<'date' | 'amount' | 'user'>('date');
  const [paymentsSortDirection, setPaymentsSortDirection] = useState<'asc' | 'desc'>('desc');

  // Real-Time Filtered & Sorted Claims Lists
  const filteredSortedClaims = useMemo(() => {
    let result = [...allClaimsDb];

    // 1. Search
    if (searchClaim.trim()) {
      const q = searchClaim.toLowerCase();
      result = result.filter(c => 
        (c.id && c.id.toLowerCase().includes(q)) ||
        (c.hospitalName && c.hospitalName.toLowerCase().includes(q)) ||
        (c.doctorName && c.doctorName.toLowerCase().includes(q)) ||
        (c.mobileNumber && c.mobileNumber.toLowerCase().includes(q)) ||
        (c.status && c.status.toLowerCase().includes(q)) ||
        (c.receiptName && c.receiptName.toLowerCase().includes(q))
      );
    }

    // 2. Sorting (by date, status, amount, and user)
    result.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (claimsSortField === 'date') {
        valA = a.date || '';
        valB = b.date || '';
      } else if (claimsSortField === 'status') {
        valA = a.status || '';
        valB = b.status || '';
      } else if (claimsSortField === 'amount') {
        valA = a.billAmount || 0;
        valB = b.billAmount || 0;
      } else if (claimsSortField === 'user') {
        valA = a.mobileNumber || '';
        valB = b.mobileNumber || '';
      }

      if (typeof valA === 'string') {
        return claimsSortDirection === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return claimsSortDirection === 'asc'
          ? valA - valB
          : valB - valA;
      }
    });

    return result;
  }, [allClaimsDb, searchClaim, claimsSortField, claimsSortDirection]);

  // Real-Time Filtered & Sorted Users Lists
  const filteredSortedUsers = useMemo(() => {
    let list = [...allUsersDb];
    if (list.length === 0) {
      // Fallback/Simulated offline list
      list = [{
        id: 'CURRENT_USER',
        mobileNumber: mobileNumber,
        name: userName,
        activePlan: userPlan,
        virtualWalletBalance: virtualWalletBalance
      }];
    }

    // 1. Search
    if (searchUser.trim()) {
      const q = searchUser.toLowerCase();
      list = list.filter(u => 
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.mobileNumber && u.mobileNumber.toLowerCase().includes(q)) ||
        (u.activePlan && u.activePlan.toLowerCase().includes(q))
      );
    }

    // 2. Sorting
    list.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (usersSortField === 'name') {
        valA = a.name || 'Anonymous User';
        valB = b.name || 'Anonymous User';
      } else if (usersSortField === 'mobile') {
        valA = a.mobileNumber || '';
        valB = b.mobileNumber || '';
      } else if (usersSortField === 'balance') {
        valA = a.virtualWalletBalance || 0;
        valB = b.virtualWalletBalance || 0;
      }

      if (typeof valA === 'string') {
        return usersSortDirection === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return usersSortDirection === 'asc'
          ? valA - valB
          : valB - valA;
      }
    });

    return list;
  }, [allUsersDb, searchUser, usersSortField, usersSortDirection, mobileNumber, userName, userPlan, virtualWalletBalance]);

  // Real-Time Filtered & Sorted Payments Lists
  const filteredSortedPayments = useMemo(() => {
    let list = [...allPaymentsDb];

    // 1. Search
    if (searchPayment.trim()) {
      const q = searchPayment.toLowerCase();
      list = list.filter(p => 
        (p.paymentId && p.paymentId.toLowerCase().includes(q)) ||
        (p.mobileNumber && p.mobileNumber.toLowerCase().includes(q)) ||
        (p.planName && p.planName.toLowerCase().includes(q)) ||
        (p.orderId && p.orderId.toLowerCase().includes(q)) ||
        (p.date && p.date.toLowerCase().includes(q))
      );
    }

    // 2. Sorting
    list.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (paymentsSortField === 'date') {
        valA = a.date || '';
        valB = b.date || '';
      } else if (paymentsSortField === 'amount') {
        valA = a.amount || 0;
        valB = b.amount || 0;
      } else if (paymentsSortField === 'user') {
        valA = a.mobileNumber || '';
        valB = b.mobileNumber || '';
      }

      if (typeof valA === 'string') {
        return paymentsSortDirection === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return paymentsSortDirection === 'asc'
          ? valA - valB
          : valB - valA;
      }
    });

    return list;
  }, [allPaymentsDb, searchPayment, paymentsSortField, paymentsSortDirection]);

  // Real-Time Filtered Hospitals List
  const filteredSortedHospitals = useMemo(() => {
    let list = [...hospitals];

    // 1. Search
    if (searchHospital.trim()) {
      const q = searchHospital.toLowerCase();
      list = list.filter(h => 
        (h.name && h.name.toLowerCase().includes(q)) ||
        (h.city && h.city.toLowerCase().includes(q)) ||
        (h.contact && h.contact.toLowerCase().includes(q)) ||
        (h.id && h.id.toLowerCase().includes(q))
      );
    }

    return list;
  }, [hospitals, searchHospital]);

  // Clock state for the simulator phone status bar
  const [phoneTime, setPhoneTime] = useState<string>('12:00');

  useEffect(() => {
    // Sync current live clock
    const updateClock = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      setPhoneTime(`${hours}:${minutes} ${ampm}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 30000);
    return () => clearInterval(interval);
  }, []);

  // Check API health on startup
  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.apiKeySet) {
          setApiStatus({ checked: true, healthy: true, message: 'Gemini server is connected and fully optimized.' });
        } else {
          setApiStatus({ checked: true, healthy: false, message: 'No GEMINI_API_KEY detected. AI operations will use highly detailed mock generation.' });
        }
      })
      .catch(() => {
        setApiStatus({ checked: true, healthy: false, message: 'Could not reach server API. Local mode activated.' });
      });
  }, []);

  // Splash Screen automatic delay
  useEffect(() => {
    if (simScreen === 'splash') {
      const timer = setTimeout(() => {
        if (isLoggedIn) {
          setSimScreen('home');
        } else {
          setSimScreen('login');
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [simScreen]);

  // Utility Copy Action
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Firestore Synchronizer
  const syncFirestoreData = async (mob: string) => {
    try {
      console.log('Synchronizing Firestore database for user:', mob);
      // 1. Get or create user profile
      let profile = await getUserProfile(mob);
      if (!profile) {
        profile = {
          mobileNumber: mob,
          userName: userName || 'Sumit Sharma',
          userPlan: 'None',
          opdLimit: 0,
          opdRemaining: 0,
          virtualWalletBalance: 0.00,
          joinedAt: new Date().toISOString().split('T')[0]
        };
        await saveUserProfile(profile);
      } else {
        setUserName(profile.userName);
        setUserPlan(profile.userPlan);
        setOpdLimit(profile.opdLimit);
        setOpdRemaining(profile.opdRemaining);
        setVirtualWalletBalance(profile.virtualWalletBalance);
      }

      // 2. Fetch user's claims
      const claimsList = await getClaims(mob);
      if (claimsList && claimsList.length > 0) {
        setClaims(claimsList);
      } else {
        // Pre-seed some claims for visual richness
        const defaultClaims: any[] = [
          { id: 'CLM-8192', hospitalName: 'Apollo Hospitals', doctorName: 'Dr. Ramesh Nair (Cardiologist)', billAmount: 1850.00, claimAmount: 1850.00, receiptName: 'apollo_opd_bill_029.png', receiptPreview: '', status: 'Approved', date: '2026-06-15', mobileNumber: mob },
          { id: 'CLM-9031', hospitalName: 'Max Super Speciality Hospital', doctorName: 'Dr. Anita Desai (Pediatrician)', billAmount: 1200.00, claimAmount: 1200.00, receiptName: 'max_invoice_4910.jpg', receiptPreview: '', status: 'Pending', date: '2026-07-02', mobileNumber: mob }
        ];
        for (const c of defaultClaims) {
          await saveClaim(c);
        }
        setClaims(defaultClaims);
      }

      // 3. Fetch user's payments
      const paymentsList = await getPayments(mob);
      if (paymentsList && paymentsList.length > 0) {
        setPayments(paymentsList);
      } else {
        const defaultPayments: any[] = [
          { id: 'PAY-4029', planName: 'Silver Regular', amount: 99.00, orderId: 'order_SVR_491039', paymentId: 'pay_SVR_491039829', date: '2026-06-10', mobileNumber: mob }
        ];
        for (const p of defaultPayments) {
          await savePayment(p);
        }
        setPayments(defaultPayments);
      }

      // 4. Fetch notifications
      const notifsList = await getNotifications(mob);
      if (notifsList && notifsList.length > 0) {
        setAppNotifications(notifsList);
      } else {
        const defaultNotif = {
          id: `NOT-${Math.floor(1000 + Math.random() * 9000)}`,
          title: 'Welcome to Gemini Care',
          message: 'Unlock cashless OPD refunds up to ₹5,000 instantly by upgrading your policy.',
          date: new Date().toISOString().split('T')[0],
          read: false,
          mobileNumber: mob
        };
        await saveNotification(defaultNotif);
        setAppNotifications([defaultNotif]);
      }

      // 5. Fetch diet plans
      const diets = await getDietPlans(mob);
      if (diets && diets.length > 0) {
        setDietPlans(diets);
      }

      // Refresh admin tables
      await refreshAdminData();
    } catch (e) {
      console.error('Firestore synchronization error:', e);
    }
  };

  const refreshAdminData = async () => {
    try {
      const uList = await getAllUsers();
      setAllUsersDb(uList);
      const pList = await getAllPayments();
      setAllPaymentsDb(pList);
      const cList = await getAllClaims();
      setAllClaimsDb(cList);
    } catch (err) {
      console.error('Admin database list pull failed:', err);
    }
  };

  // Pre-seed hospitals in Firestore if empty
  const initHospitals = async () => {
    const defaultHospitals = [
      { id: '1', name: 'Apollo Hospitals', address: 'Greams Road, Thousand Lights', contact: '+91 44 2829 0200', city: 'Chennai' },
      { id: '2', name: 'Fortis Memorial Research Institute', address: 'Sector 44, Opposite HUDA City Centre', contact: '+91 124 496 2200', city: 'Gurugram' },
      { id: '3', name: 'Max Super Speciality Hospital', address: '1, 2, Press Enclave Road, Saket', contact: '+91 11 2651 5050', city: 'New Delhi' },
      { id: '4', name: 'Kokilaben Dhirubhai Ambani Hospital', address: 'Rao Saheb, Achutrao Patwardhan Marg, Four Bungalows', contact: '+91 22 4269 6969', city: 'Mumbai' }
    ];
    try {
      const list = await getHospitals();
      if (list && list.length > 0) {
        setHospitals(list);
      } else {
        for (const h of defaultHospitals) {
          await saveHospital(h);
        }
        setHospitals(defaultHospitals);
      }
    } catch (e) {
      console.warn('Hospital database seeding failed, falling back to local offline list:', e);
      setHospitals(defaultHospitals);
    }
  };

  useEffect(() => {
    initHospitals();
  }, []);

  // OTP Login Process Flow
  const handleRequestOtp = () => {
    if (!mobileNumber || mobileNumber.length < 10) {
      setAuthError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setAuthError(null);
    setOtpSent(true);
  };

  const handleVerifyOtp = async () => {
    if (otpCode === '123456' || otpCode.trim().length >= 4) {
      setIsLoggedIn(true);
      setAuthError(null);
      setSimScreen('home');
      await syncFirestoreData(mobileNumber);
    } else {
      setAuthError('Invalid verification code. Please enter 123456 to test the OTP flow.');
    }
  };

  // Razorpay Checkout Simulator
  const launchRazorpay = (planName: string, price: number, claimsCount: number) => {
    setRazorpayPlan({ name: planName, price, claims: claimsCount });
    setRazorpayStep('details');
    setRazorpayOpen(true);
  };

  const executeRazorpayPayment = async () => {
    if (!razorpayPlan) return;
    setRazorpayStep('processing');
    
    // Simulate Gateway capture delay
    setTimeout(async () => {
      setRazorpayStep('success');
      
      const orderRef = `order_rzp_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const payRef = `pay_rzp_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      
      const newPayment: Payment = {
        id: `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
        planName: razorpayPlan.name,
        amount: razorpayPlan.price,
        orderId: orderRef,
        paymentId: payRef,
        date: new Date().toISOString().split('T')[0],
        mobileNumber: mobileNumber
      };

      // Write payment and upgrade profile in Firestore
      try {
        await savePayment(newPayment);
        const nextLimit = razorpayPlan.claims;
        const nextProfile = {
          mobileNumber,
          userName,
          userPlan: razorpayPlan.name,
          opdLimit: nextLimit,
          opdRemaining: nextLimit,
          virtualWalletBalance,
          joinedAt: new Date().toISOString().split('T')[0]
        };
        await saveUserProfile(nextProfile);
        
        // Sync local React states
        setUserPlan(razorpayPlan.name);
        setOpdLimit(nextLimit);
        setOpdRemaining(nextLimit);
        setPayments(prev => [newPayment, ...prev]);
        
        // Push notification of active plan
        const purchaseNotif = {
          id: `NOT-${Math.floor(1000 + Math.random() * 9000)}`,
          title: 'OPD Plan Activated!',
          message: `Your ${razorpayPlan.name} cashless policy is now fully active with ${razorpayPlan.claims} claim credits.`,
          date: new Date().toISOString().split('T')[0],
          read: false,
          mobileNumber: mobileNumber
        };
        await saveNotification(purchaseNotif);
        setAppNotifications(prev => [purchaseNotif, ...prev]);
      } catch (err) {
        console.error('Failed to register subscription payment in Firestore:', err);
      }

      setTimeout(() => {
        setRazorpayOpen(false);
        setRazorpayPlan(null);
        setSimScreen('home');
        refreshAdminData();
      }, 1500);
    }, 2000);
  };

  // OPD Claim Handling
  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (file.type.startsWith('image/')) {
        setCropSourceFileName(file.name);
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
          setCropSourceImage(uploadEvent.target?.result as string);
          setCropZoom(1);
          setCropRotation(0);
          setCropTranslate({ x: 0, y: 0 });
          setCropBox({ x: 30, y: 30, width: 220, height: 280 });
          setIsFreeCrop(false);
          setAutoStraightenedAngle(null);
          setIsCropModalOpen(true);
        };
        reader.readAsDataURL(file);
      } else {
        // Fallback for PDF or other formats
        setClaimReceipt(file);
        setClaimReceiptName(file.name);
        
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
          setClaimReceiptPreview(uploadEvent.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Run auto-straightening algorithm on load
  const runAutoStraightenAndEdgeDetection = (img: HTMLImageElement) => {
    try {
      const canvas = document.createElement('canvas');
      const maxAnalysisDim = 300;
      let width = img.naturalWidth;
      let height = img.naturalHeight;
      if (width > maxAnalysisDim || height > maxAnalysisDim) {
        if (width > height) {
          height = Math.round((height * maxAnalysisDim) / width);
          width = maxAnalysisDim;
        } else {
          width = Math.round((width * maxAnalysisDim) / height);
          height = maxAnalysisDim;
        }
      }
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, width, height);

      const skew = detectSkewAngle(canvas);
      if (Math.abs(skew) > 0.3) {
        setCropRotation(-skew);
        setAutoStraightenedAngle(-skew);
      } else {
        setCropRotation(0);
        setAutoStraightenedAngle(0);
      }
    } catch (err) {
      console.warn("Auto-straightening failed on load:", err);
    }
  };

  // Run on-demand boundary analysis
  const runEdgeDetection = (img: HTMLImageElement) => {
    try {
      const canvas = document.createElement('canvas');
      const maxAnalysisDim = 300;
      let width = img.naturalWidth;
      let height = img.naturalHeight;
      if (width > maxAnalysisDim || height > maxAnalysisDim) {
        if (width > height) {
          height = Math.round((height * maxAnalysisDim) / width);
          width = maxAnalysisDim;
        } else {
          width = Math.round((width * maxAnalysisDim) / height);
          height = maxAnalysisDim;
        }
      }
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, width, height);

      const detected = detectDocumentEdges(canvas);
      if (detected) {
        const imgAspectRatio = img.naturalWidth / img.naturalHeight;
        let displayWidth = 260;
        let displayHeight = 260 / imgAspectRatio;
        if (displayHeight > 320) {
          displayHeight = 320;
          displayWidth = 320 * imgAspectRatio;
        }

        const imgLeft = 140 - displayWidth / 2;
        const imgTop = 170 - displayHeight / 2;

        const relX = detected.x / width;
        const relY = detected.y / height;
        const relWidth = detected.width / width;
        const relHeight = detected.height / height;

        const mappedX = Math.max(5, Math.min(270, imgLeft + relX * displayWidth));
        const mappedY = Math.max(5, Math.min(330, imgTop + relY * displayHeight));
        const mappedWidth = Math.max(40, Math.min(270 - mappedX, relWidth * displayWidth));
        const mappedHeight = Math.max(40, Math.min(330 - mappedY, relHeight * displayHeight));

        setCropBox({
          x: mappedX,
          y: mappedY,
          width: mappedWidth,
          height: mappedHeight
        });
        setIsFreeCrop(true);
      }
    } catch (err) {
      console.warn("Document edge detection failed:", err);
    }
  };

  // Mouse drag handlers for cropper
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    translateStart.current = { ...cropTranslate };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // If a corner handle is being adjusted, update the crop box boundaries
    if (draggedHandle !== 'none') {
      const rect = cropContainerRef.current?.getBoundingClientRect();
      if (rect) {
        const clientX = e.clientX;
        const clientY = e.clientY;
        const localX = clientX - rect.left;
        const localY = clientY - rect.top;

        setCropBox(prev => {
          let next = { ...prev };
          const minSize = 40;
          
          if (draggedHandle === 'nw') {
            const right = prev.x + prev.width;
            const bottom = prev.y + prev.height;
            next.x = Math.max(5, Math.min(localX, right - minSize));
            next.width = right - next.x;
            next.y = Math.max(5, Math.min(localY, bottom - minSize));
            next.height = bottom - next.y;
          } else if (draggedHandle === 'ne') {
            const bottom = prev.y + prev.height;
            const left = prev.x;
            const newRight = Math.max(left + minSize, Math.min(localX, 275));
            next.width = newRight - left;
            next.y = Math.max(5, Math.min(localY, bottom - minSize));
            next.height = bottom - next.y;
          } else if (draggedHandle === 'sw') {
            const right = prev.x + prev.width;
            const top = prev.y;
            next.x = Math.max(5, Math.min(localX, right - minSize));
            next.width = right - next.x;
            const newBottom = Math.max(top + minSize, Math.min(localY, 335));
            next.height = newBottom - top;
          } else if (draggedHandle === 'se') {
            const left = prev.x;
            const top = prev.y;
            const newRight = Math.max(left + minSize, Math.min(localX, 275));
            next.width = newRight - left;
            const newBottom = Math.max(top + minSize, Math.min(localY, 335));
            next.height = newBottom - top;
          }
          return next;
        });
      }
      return;
    }

    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setCropTranslate({
      x: translateStart.current.x + dx,
      y: translateStart.current.y + dy
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedHandle('none');
  };

  // Touch gesture handlers for cropper (Single drag, Dual pinch zoom, Handle resizing)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      translateStart.current = { ...cropTranslate };
      touchStartDist.current = null;
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDist.current = dist;
      zoomStartVal.current = cropZoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (draggedHandle !== 'none' && e.touches.length === 1) {
      const rect = cropContainerRef.current?.getBoundingClientRect();
      if (rect) {
        const clientX = e.touches[0].clientX;
        const clientY = e.touches[0].clientY;
        const localX = clientX - rect.left;
        const localY = clientY - rect.top;

        setCropBox(prev => {
          let next = { ...prev };
          const minSize = 40;
          
          if (draggedHandle === 'nw') {
            const right = prev.x + prev.width;
            const bottom = prev.y + prev.height;
            next.x = Math.max(5, Math.min(localX, right - minSize));
            next.width = right - next.x;
            next.y = Math.max(5, Math.min(localY, bottom - minSize));
            next.height = bottom - next.y;
          } else if (draggedHandle === 'ne') {
            const bottom = prev.y + prev.height;
            const left = prev.x;
            const newRight = Math.max(left + minSize, Math.min(localX, 275));
            next.width = newRight - left;
            next.y = Math.max(5, Math.min(localY, bottom - minSize));
            next.height = bottom - next.y;
          } else if (draggedHandle === 'sw') {
            const right = prev.x + prev.width;
            const top = prev.y;
            next.x = Math.max(5, Math.min(localX, right - minSize));
            next.width = right - next.x;
            const newBottom = Math.max(top + minSize, Math.min(localY, 335));
            next.height = newBottom - top;
          } else if (draggedHandle === 'se') {
            const left = prev.x;
            const top = prev.y;
            const newRight = Math.max(left + minSize, Math.min(localX, 275));
            next.width = newRight - left;
            const newBottom = Math.max(top + minSize, Math.min(localY, 335));
            next.height = newBottom - top;
          }
          return next;
        });
      }
      return;
    }

    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      setCropTranslate({
        x: translateStart.current.x + dx,
        y: translateStart.current.y + dy
      });
    } else if (e.touches.length === 2 && touchStartDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / touchStartDist.current;
      const newZoom = Math.max(1, Math.min(4, zoomStartVal.current * scale));
      setCropZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartDist.current = null;
    setDraggedHandle('none');
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const zoomIntensity = 0.05;
    const delta = e.deltaY < 0 ? 1 : -1;
    const newZoom = Math.max(1, Math.min(4, cropZoom + delta * zoomIntensity));
    setCropZoom(newZoom);
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      displayWidth: img.clientWidth,
      displayHeight: img.clientHeight
    });
    setCropTranslate({ x: 0, y: 0 });
    setCropZoom(1);
    setCropRotation(0);
    setCropBox({ x: 30, y: 30, width: 220, height: 280 });
    setIsFreeCrop(false);
    setAutoStraightenedAngle(null);

    // Auto-straighten receipt using edge and orientation projection profiles
    runAutoStraightenAndEdgeDetection(img);
  };

  const handleHandleMouseDown = (handle: 'nw' | 'ne' | 'sw' | 'se', e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggedHandle(handle);
  };

  const handleHandleTouchStart = (handle: 'nw' | 'ne' | 'sw' | 'se', e: React.TouchEvent) => {
    e.stopPropagation();
    setDraggedHandle(handle);
  };

  const applyCropAndOptimize = () => {
    const img = imgRef.current;
    if (!img) return;

    const scaleFactor = 4.5; // High-res output scaling for crisp text OCR
    const currentCropBox = isFreeCrop ? cropBox : { x: 30, y: 30, width: 220, height: 280 };
    
    const cropBoxWidth = currentCropBox.width;
    const cropBoxHeight = currentCropBox.height;
    const canvasWidth = cropBoxWidth * scaleFactor;
    const canvasHeight = cropBoxHeight * scaleFactor;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill with high-contrast solid white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Apply exact visual transformation tree to coordinate system
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    
    // Offset calculation relative to crop box center
    const cropCenterX = currentCropBox.x + currentCropBox.width / 2;
    const cropCenterY = currentCropBox.y + currentCropBox.height / 2;
    
    const relX = (cropTranslate.x + (140 - cropCenterX)) * scaleFactor;
    const relY = (cropTranslate.y + (170 - cropCenterY)) * scaleFactor;
    
    ctx.translate(relX, relY);
    ctx.rotate((cropRotation * Math.PI) / 180);
    ctx.scale(cropZoom, cropZoom);

    // Calculate display dimensions of the image inside the display container (max 260x320)
    const imgAspectRatio = imageDimensions.naturalWidth / imageDimensions.naturalHeight;
    let displayWidth = 260;
    let displayHeight = 260 / imgAspectRatio;
    if (displayHeight > 320) {
      displayHeight = 320;
      displayWidth = 320 * imgAspectRatio;
    }

    const drawWidth = displayWidth * scaleFactor;
    const drawHeight = displayHeight * scaleFactor;

    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

    // Apply high-contrast Auto-Enhance Document OCR Filter
    if (isEnhanced) {
      const pixels = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      const data = pixels.data;
      
      // Calculate min/max luminance for stretching
      let minLuma = 255;
      let maxLuma = 0;
      const lumas = new Uint8Array(canvasWidth * canvasHeight);
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        lumas[i / 4] = l;
        if (l < minLuma) minLuma = l;
        if (l > maxLuma) maxLuma = l;
      }
      
      const range = maxLuma - minLuma || 1;
      
      // Apply contrast-stretch and illumination normalization
      for (let i = 0; i < data.length; i += 4) {
        const idx = i / 4;
        const l = lumas[idx];
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        const norm = (l - minLuma) / range;
        let factor = 1.0;
        if (norm > 0.45) {
          // Flatten paper shadows to bright white background
          factor = 1.0 + (norm - 0.45) * 1.5;
        } else {
          // Increase printed ink density
          factor = 0.4 + norm * 0.6;
        }
        
        data[i]     = Math.max(0, Math.min(255, r * factor));
        data[i + 1] = Math.max(0, Math.min(255, g * factor));
        data[i + 2] = Math.max(0, Math.min(255, b * factor));
      }
      ctx.putImageData(pixels, 0, 0);
    }

    // Encode to high-quality JPEG
    const base64Str = canvas.toDataURL('image/jpeg', 0.85);
    setClaimReceiptPreview(base64Str);
    setClaimReceiptName(cropSourceFileName);

    // Save as matching File object in case any backend handles raw files
    fetch(base64Str)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], cropSourceFileName, { type: 'image/jpeg' });
        setClaimReceipt(file);
      })
      .catch(err => {
        console.warn("File matching blob creation failed, proceeding with base64 state:", err);
      });

    setIsCropModalOpen(false);
  };

  const submitOpdClaim = async () => {
    if (opdRemaining <= 0 && userPlan !== 'Gold Max Pro') {
      setClaimError('You have no remaining claim balances. Please renew or upgrade your premium plan first.');
      return;
    }
    if (!claimDoctor.trim()) {
      setClaimError('Please provide the diagnosing doctor\'s name.');
      return;
    }
    if (!claimBillAmount || parseFloat(claimBillAmount) <= 0) {
      setClaimError('Please enter a valid bill amount.');
      return;
    }
    if (!claimReceiptName) {
      setClaimError('Please upload/attach your medical invoice receipt.');
      return;
    }

    const matchedHospital = hospitals.find(h => h.id === claimHospital)?.name || 'Empanelled Hospital';
    const parsedBill = parseFloat(claimBillAmount);

    const newClaim: Claim = {
      id: `CLM-${Math.floor(1000 + Math.random() * 9000)}`,
      hospitalName: matchedHospital,
      doctorName: claimDoctor,
      billAmount: parsedBill,
      claimAmount: parsedBill,
      receiptName: claimReceiptName,
      receiptPreview: claimReceiptPreview || '',
      status: 'Pending',
      date: claimDate,
      mobileNumber: mobileNumber
    };

    // Store in Firestore and update remaining claim counter
    try {
      await saveClaim(newClaim);
      const nextRemaining = userPlan === 'Gold Max Pro' ? 999 : Math.max(0, opdRemaining - 1);
      
      const nextProfile = {
        mobileNumber,
        userName,
        userPlan,
        opdLimit,
        opdRemaining: nextRemaining,
        virtualWalletBalance,
        joinedAt: new Date().toISOString().split('T')[0]
      };
      await saveUserProfile(nextProfile);
      
      // Update local state
      setOpdRemaining(nextRemaining);
      setClaims(prev => [newClaim, ...prev]);

      // Add a status tracker notification
      const claimNotif = {
        id: `NOT-${Math.floor(1000 + Math.random() * 9000)}`,
        title: 'Claim Registration Success',
        message: `Your OPD claim ${newClaim.id} for ₹${parsedBill} is registered in the queue. Admin reviews usually conclude within 15 minutes.`,
        date: new Date().toISOString().split('T')[0],
        read: false,
        mobileNumber: mobileNumber
      };
      await saveNotification(claimNotif);
      setAppNotifications(prev => [claimNotif, ...prev]);
    } catch (err) {
      console.error('Failed to submit claim to Firestore:', err);
    }

    // Save submitted claim details for confirmation screen
    setSubmittedClaim(newClaim);

    // Reset Form
    setClaimDoctor('');
    setClaimBillAmount('');
    setClaimReceipt(null);
    setClaimReceiptName('');
    setClaimReceiptPreview(null);
    setClaimError(null);
    
    // Direct to confirmation screen
    setSimScreen('claim_confirmation');
    refreshAdminData();
  };

  // Real-time server-side OpenAI chat API calls (using OpenAI proxy with fallbacks)
  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMsgText = chatInput;
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage: Message = { role: 'user', text: userMsgText, timestamp: timestampStr };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/openai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `[USER STATE] Mobile: ${mobileNumber}, Plan: ${userPlan}, Wallet: ₹${virtualWalletBalance}. User question: ${userMsgText}`
        })
      });

      const data = await response.json();
      const modelTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      if (response.ok && data.text) {
        setChatMessages(prev => [...prev, { role: 'model', text: data.text, timestamp: modelTimestamp }]);
      } else {
        throw new Error(data.error || 'OpenAI server returned an error');
      }
    } catch (err: any) {
      // Fallback helpful mock simulation if key not present or error occurs
      setTimeout(() => {
        const fallbackText = `I hear your concern. Under your active policy, please note that clinical diagnoses are not made by AI. I highly recommend visiting one of our empanelled facilities (such as Apollo or Max Hospital) for an in-person diagnostic test. 

**Lifestyle Tip:** For general well-being, maintain a balanced sodium/hydration ratio and stick to scheduled medicine timings.

*Disclaimer: I am an OpenAI Health Companion, not a certified doctor. Please consult a qualified medical professional for any diagnosis, treatment, or medical emergencies.*`;
        const modelTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setChatMessages(prev => [...prev, { role: 'model', text: fallbackText, timestamp: modelTimestamp }]);
      }, 1000);
    } finally {
      setChatLoading(false);
    }
  };

  // Real-time server-side Gemini Clinical Diet Planner with health metrics
  const handleGenerateDiet = async () => {
    setDietLoading(true);
    setGeneratedDiet(null);

    const formattedPrompt = `Generate a daily clinical nutrition diet plan for a ${dietAge}-year-old user.
    Metrics: Height ${dietHeight} cm, Weight ${dietWeight} kg, Goal "${dietGoal}", Preference "${dietType}".
    Co-morbidities: Diabetes: "${dietDiabetes}", Blood Pressure (BP): "${dietBP}".
    
    CRITICAL NUTRIENT CONSTRAINTS:
    - If Diabetes is Active (Type 1, Type 2, or Pre-Diabetic), design a menu strictly devoid of high-sugar items, preferring low-glycemic complex carbs.
    - If Blood Pressure is Active (High or Low), adjust sodium and mineral counts accordingly (e.g. recommend a Dash diet pattern with potassium-rich additions if BP is High).
    
    Return the schedule structured in JSON form containing exact, highly detailed options for breakfast, lunch, dinner, and snacks. Provide healthy, clinical options suitable for India-based diets.`;

    try {
      const response = await fetch('/api/generate-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: formattedPrompt,
          systemInstruction: 'You are an elite clinical nutritionist. You must evaluate diabetes and BP co-morbidities first, tailoring the sodium and glucose levels. Provide highly precise, calibrated, calorie-controlled plans.',
          fields: [
            { name: 'calories', type: 'integer', description: 'Total daily target calories count' },
            { name: 'breakfast', type: 'string', description: 'Recommended nutritious breakfast recipe' },
            { name: 'lunch', type: 'string', description: 'Calibrated protein-rich lunch details' },
            { name: 'dinner', type: 'string', description: 'Light digestible healthy dinner meal details' },
            { name: 'snacks', type: 'string', description: 'Pre-workout or evening snacks' }
          ]
        })
      });

      const data = await response.json();
      if (response.ok && data.text) {
        const parsedJson = JSON.parse(data.text);
        const freshPlan: DietPlan = {
          id: `DIET-${Math.floor(100 + Math.random() * 900)}`,
          age: dietAge,
          height: dietHeight,
          weight: dietWeight,
          goal: dietGoal,
          dietaryType: dietType,
          diabetes: dietDiabetes,
          bp: dietBP,
          calories: parsedJson.calories || 1900,
          meals: {
            breakfast: parsedJson.breakfast,
            lunch: parsedJson.lunch,
            dinner: parsedJson.dinner,
            snacks: parsedJson.snacks
          },
          date: new Date().toISOString().split('T')[0],
          mobileNumber: mobileNumber
        };
        
        await saveDietPlan(freshPlan);
        setDietPlans(prev => [freshPlan, ...prev]);
        setGeneratedDiet(freshPlan);
      } else {
        throw new Error('Database JSON parse error');
      }
    } catch (err) {
      // Mock accurate clinical plan on failure
      setTimeout(async () => {
        const mockCal = dietGoal === 'Weight Loss' ? 1600 : (dietGoal === 'Muscle Gain' ? 2450 : 2000);
        const freshPlan: DietPlan = {
          id: `DIET-${Math.floor(100 + Math.random() * 900)}`,
          age: dietAge,
          height: dietHeight,
          weight: dietWeight,
          goal: dietGoal,
          dietaryType: dietType,
          diabetes: dietDiabetes,
          bp: dietBP,
          calories: mockCal,
          meals: {
            breakfast: dietType === 'Vegetarian' 
              ? `Sprouted Moong Salad with a cup of green tea. ${dietDiabetes !== 'No' ? '[Low Sugar Optimized]' : ''}`
              : `Egg-white omelette (3 eggs) with spinach and 1 slice of multi-grain toast. ${dietBP !== 'No' ? '[Salt Controlled]' : ''}`,
            lunch: dietType === 'Vegetarian'
              ? 'Brown rice (1 cup) with mixed vegetable Dal and grilled low-sodium paneer (100g) cubes.'
              : 'Boiled chicken breast (150g) with mixed herb salad, broccoli, and steamed brown rice.',
            dinner: 'Thick yellow organic lentil soup with steamed asparagus, mushrooms, and 1 whole-wheat flatbread.',
            snacks: 'Handful of roasted unsalted pumpkin seeds and half an apple.'
          },
          date: new Date().toISOString().split('T')[0],
          mobileNumber: mobileNumber
        };
        await saveDietPlan(freshPlan);
        setDietPlans(prev => [freshPlan, ...prev]);
        setGeneratedDiet(freshPlan);
      }, 1500);
    } finally {
      setDietLoading(false);
    }
  };

  // Admin approvals & Firestore updates
  const handleApproveClaim = async (claimId: string, claimAmount: number, userMobNum: string) => {
    try {
      // 1. Update claim status in Firestore
      await updateClaimStatus(claimId, 'Approved');
      
      // 2. Load user profile, credit wallet
      let profile = await getUserProfile(userMobNum);
      if (profile) {
        const updatedBal = parseFloat((profile.virtualWalletBalance + claimAmount).toFixed(2));
        const updatedProfile = {
          ...profile,
          virtualWalletBalance: updatedBal
        };
        await saveUserProfile(updatedProfile);
        
        // If the logged-in user is the one being approved, sync their local state
        if (userMobNum === mobileNumber) {
          setVirtualWalletBalance(updatedBal);
        }
      }

      // 3. Push credit alert notification to user
      const creditNotif = {
        id: `NOT-${Math.floor(1000 + Math.random() * 9000)}`,
        title: 'OPD Reimbursement Approved! 💸',
        message: `Your OPD claim ${claimId} for ₹${claimAmount} is approved. Funds have been credited to your digital wellness wallet.`,
        date: new Date().toISOString().split('T')[0],
        read: false,
        mobileNumber: userMobNum
      };
      await saveNotification(creditNotif);

      // Local syncs
      setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: 'Approved' } : c));
      await refreshAdminData();
    } catch (err) {
      console.error('Failed to approve claim on Firestore:', err);
    }
  };

  const handleRejectClaim = async (claimId: string, userMobNum: string) => {
    try {
      // 1. Update claim status in Firestore
      await updateClaimStatus(claimId, 'Rejected');

      // 2. Push rejection advice notification to user
      const rejectNotif = {
        id: `NOT-${Math.floor(1000 + Math.random() * 9000)}`,
        title: 'Claim Correction Required ⚠️',
        message: `Your OPD claim ${claimId} was rejected. Please ensure the doctor's name on your invoice is clearly visible and submit again.`,
        date: new Date().toISOString().split('T')[0],
        read: false,
        mobileNumber: userMobNum
      };
      await saveNotification(rejectNotif);

      // Local syncs
      setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: 'Rejected' } : c));
      await refreshAdminData();
    } catch (err) {
      console.error('Failed to reject claim on Firestore:', err);
    }
  };

  const handleAddHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHospitalName || !newHospitalCity) return;
    const newHosp: Hospital = {
      id: String(hospitals.length + 1),
      name: newHospitalName,
      address: newHospitalAddress || 'Main Road',
      contact: newHospitalContact || '+91 11 0000 0000',
      city: newHospitalCity
    };
    try {
      await saveHospital(newHosp);
      setHospitals(prev => [...prev, newHosp]);
      setNewHospitalName('');
      setNewHospitalAddress('');
      setNewHospitalContact('');
      setNewHospitalCity('');
    } catch (err) {
      console.error('Failed to add hospital to Firestore:', err);
    }
  };

  // Reset Simulation Entirely
  const handleResetSimulation = () => {
    setIsLoggedIn(false);
    setOtpSent(false);
    setOtpCode('');
    setUserPlan('None');
    setOpdLimit(0);
    setOpdRemaining(0);
    setVirtualWalletBalance(0);
    setClaims([
      { id: 'CLM-8192', hospitalName: 'Apollo Hospitals', doctorName: 'Dr. Ramesh Nair (Cardiologist)', billAmount: 1850.00, claimAmount: 1850.00, receiptName: 'apollo_opd_bill_029.png', status: 'Approved', date: '2026-06-15' },
      { id: 'CLM-9031', hospitalName: 'Max Super Speciality Hospital', doctorName: 'Dr. Anita Desai (Pediatrician)', billAmount: 1200.00, claimAmount: 1200.00, receiptName: 'max_invoice_4910.jpg', status: 'Pending', date: '2026-07-02' }
    ]);
    setPayments([
      { id: 'PAY-4029', planName: 'Silver Regular', amount: 99.00, orderId: 'order_SVR_491039', paymentId: 'pay_SVR_491039829', date: '2026-06-10' }
    ]);
    setSimScreen('splash');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Header Panel */}
      <header className="border-b border-zinc-900 bg-zinc-950 px-6 py-4.5 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-950/80 border border-indigo-900/60 rounded-xl text-indigo-400">
            <Heart className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg tracking-tight text-white">Gemini Care</h1>
              <span className="text-[10px] font-semibold font-mono tracking-widest bg-zinc-900 text-zinc-400 px-2 py-0.5 rounded border border-zinc-800">
                DEVELOPER DECK
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">Interactive database, Flutter clean architecture structure, and full-screen mobile simulator</p>
          </div>
        </div>

        {/* Global Tab Selectors */}
        <div className="flex flex-wrap gap-1.5 items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 shrink-0">
          <button
            onClick={() => setActiveWorkspaceTab('simulator')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeWorkspaceTab === 'simulator'
                ? 'bg-zinc-800 text-indigo-400 shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>App Simulator</span>
          </button>
          <button
            onClick={() => setActiveWorkspaceTab('database')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeWorkspaceTab === 'database'
                ? 'bg-zinc-800 text-indigo-400 shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>SQL Database</span>
          </button>
          <button
            onClick={() => setActiveWorkspaceTab('flutter')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeWorkspaceTab === 'flutter'
                ? 'bg-zinc-800 text-indigo-400 shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Flutter Code</span>
          </button>
          <button
            onClick={() => {
              setActiveWorkspaceTab('admin');
              refreshAdminData();
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeWorkspaceTab === 'admin'
                ? 'bg-zinc-800 text-indigo-400 shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Admin Control Panel</span>
          </button>
          <button
            onClick={() => setActiveWorkspaceTab('publishing')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeWorkspaceTab === 'publishing'
                ? 'bg-zinc-800 text-indigo-400 shadow'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Google Play Publishing</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-hidden">
        
        {/* Left Area: Always the Interactive Phone Simulator for quick reference */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          
          {/* External Simulator Controls */}
          <div className="w-full max-w-sm mb-4 flex justify-between items-center bg-zinc-900/60 border border-zinc-800 px-4 py-2.5 rounded-xl text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isLoggedIn ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>{isLoggedIn ? `Logged in: +91 ${mobileNumber}` : 'Unauthenticated'}</span>
            </span>
            <button
              onClick={handleResetSimulation}
              className="text-indigo-400 hover:text-indigo-300 font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset State</span>
            </button>
          </div>

          {/* Device Shell */}
          <div className="relative w-full max-w-[340px] aspect-[9/18.5] bg-zinc-950 rounded-[48px] border-[12px] border-zinc-800 p-3 shadow-2xl flex flex-col overflow-hidden ring-4 ring-zinc-900">
            
            {/* Speaker Grill & Camera Punch Hole */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-7 bg-zinc-800 rounded-b-3xl z-50 flex items-center justify-center gap-2">
              <div className="w-12 h-1 bg-zinc-900 rounded" />
              <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full" />
            </div>

            {/* Phone Status Bar */}
            <div className="h-7 w-full flex items-center justify-between px-4 text-[10px] text-zinc-400 font-mono select-none mt-1 z-30">
              <span className="font-semibold">{phoneTime}</span>
              <div className="flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5" />
                <span className="text-[9px] font-bold tracking-tighter">5G</span>
                <Battery className="w-4 h-4" />
              </div>
            </div>

            {/* Simulated Live Environment Screen Area */}
            <div className="flex-1 bg-zinc-900 rounded-[34px] overflow-hidden flex flex-col relative z-20">
              
              {/* SCREEN: Splash */}
              {simScreen === 'splash' && (
                <div className="flex-1 bg-gradient-to-b from-indigo-950 to-zinc-950 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-20 h-20 bg-indigo-600/10 border border-indigo-500/20 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/10">
                    <Heart className="w-10 h-10 text-indigo-400 animate-pulse" />
                  </div>
                  <h2 className="text-xl font-extrabold text-white tracking-tight">Gemini Care</h2>
                  <p className="text-[11px] text-zinc-400 mt-2 font-mono">OPD Claims &amp; Digital Wellness</p>
                  
                  <div className="absolute bottom-16 flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                    <span className="text-[10px] text-zinc-500 font-mono">Loading Material 3 environment...</span>
                  </div>
                </div>
              )}

              {/* SCREEN: Login (Mobile OTP Guard) */}
              {simScreen === 'login' && (
                <div className="flex-1 bg-zinc-950 flex flex-col justify-between p-6">
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="flex justify-center mb-6">
                      <div className="p-4 bg-indigo-950/50 rounded-2xl border border-indigo-900/40 text-indigo-400">
                        <ShieldCheck className="w-10 h-10" />
                      </div>
                    </div>
                    <h2 className="text-lg font-bold text-center text-white">OPD Protection Login</h2>
                    <p className="text-xs text-zinc-500 text-center mt-1.5 px-4">
                      Enter your mobile number to receive your secure verification OTP.
                    </p>

                    <div className="mt-8 space-y-4">
                      {!otpSent ? (
                        <>
                          <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold font-mono">
                            Registered Mobile
                          </label>
                          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5">
                            <span className="text-zinc-400 text-sm mr-2 font-semibold font-mono border-r border-zinc-800 pr-2">
                              +91
                            </span>
                            <input
                              type="tel"
                              value={mobileNumber}
                              onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                              maxLength={10}
                              placeholder="Mobile number"
                              className="bg-transparent text-sm text-white focus:outline-none w-full font-mono font-semibold"
                            />
                          </div>

                          <button
                            onClick={handleRequestOtp}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3 rounded-xl transition shadow shadow-indigo-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>Request OTP Verification</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="bg-indigo-950/30 border border-indigo-900/40 px-3 py-2 rounded-xl text-[10px] text-zinc-400 font-mono text-center mb-1">
                            🔑 Test Verification OTP is <span className="text-indigo-400 font-bold">123456</span>
                          </div>

                          <label className="block text-[10px] uppercase tracking-wider text-zinc-400 font-bold font-mono">
                            6-Digit Verification Code
                          </label>
                          <input
                            type="text"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                            maxLength={6}
                            placeholder="Enter 123456"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-center text-sm font-mono font-bold tracking-widest text-white focus:outline-none focus:border-indigo-500"
                          />

                          <div className="flex gap-2">
                            <button
                              onClick={() => setOtpSent(false)}
                              className="w-1/3 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 text-xs py-3 rounded-xl transition cursor-pointer font-semibold"
                            >
                              Back
                            </button>
                            <button
                              onClick={handleVerifyOtp}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-3 rounded-xl transition shadow shadow-indigo-600/30 cursor-pointer"
                            >
                              Verify Code
                            </button>
                          </div>
                        </>
                      )}

                      {authError && (
                        <p className="text-[11px] text-red-400 text-center font-mono mt-2 bg-red-950/20 border border-red-900/40 py-1.5 px-2 rounded-lg">
                          {authError}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-[9px] text-zinc-600 font-mono">Secured via Firebase Mobile Auth Engine</p>
                  </div>
                </div>
              )}

              {/* SCREEN: Home (Dashboard) */}
              {simScreen === 'home' && (
                <div className="flex-1 bg-zinc-950 flex flex-col justify-between overflow-y-auto">
                  
                  {/* Top Profile Header */}
                  <div className="p-4 bg-zinc-900 border-b border-zinc-950 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-indigo-900/60 border border-indigo-700 flex items-center justify-center text-indigo-400">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-500">Welcome back</div>
                        <h4 className="text-xs font-bold text-white leading-tight">{userName}</h4>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSimScreen('notifications')}
                        className="relative p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-850 rounded-lg transition cursor-pointer"
                        title="Notifications"
                      >
                        <Bell className="w-4 h-4" />
                        {appNotifications.filter(n => !n.read).length > 0 && (
                          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                        )}
                      </button>
                      <button
                        onClick={() => setSimScreen('admin')}
                        className="text-[9px] font-bold text-amber-400 border border-amber-900/50 bg-amber-950/30 px-2 py-1 rounded-lg hover:bg-amber-950/50 transition cursor-pointer"
                      >
                        Admin Panel
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Workspace Dashboard Area */}
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    
                    {/* Active Subscription Plan Card */}
                    <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 border border-indigo-800/60 rounded-2xl p-4 shadow-xl text-white relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 rounded-full blur-xl" />
                      
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[9px] font-semibold bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded-full font-mono">
                            ACTIVE POLICY
                          </span>
                          <h3 className="text-sm font-black mt-2 tracking-tight">
                            {userPlan === 'None' ? 'No Subscription Active' : userPlan}
                          </h3>
                        </div>
                        <Heart className="w-5 h-5 text-indigo-400 animate-pulse" />
                      </div>

                      <div className="mt-4 flex justify-between items-end border-t border-indigo-800/40 pt-3">
                        <div>
                          <p className="text-[9px] text-indigo-300">OPD Claims Remaining</p>
                          <p className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                            {userPlan === 'Gold Max Pro' ? 'Unlimited Claims' : `${opdRemaining} / ${opdLimit}`}
                          </p>
                        </div>
                        <button
                          onClick={() => setSimScreen('plans')}
                          className="bg-white text-indigo-900 font-extrabold text-[10px] px-3 py-1.5 rounded-lg hover:bg-zinc-100 transition cursor-pointer"
                        >
                          Renew / Upgrade
                        </button>
                      </div>
                    </div>

                    {/* Razorpay Banner if un-subscribed */}
                    {userPlan === 'None' && (
                      <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-3 text-center">
                        <p className="text-[11px] text-amber-300">🔒 Claims locked. Buy a premium plan from ₹29 to activate OPD.</p>
                        <button
                          onClick={() => setSimScreen('plans')}
                          className="mt-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[10px] font-extrabold px-3 py-1 rounded-lg transition cursor-pointer"
                        >
                          Unlock Protection Now
                        </button>
                      </div>
                    )}

                    {/* Quick Core Navigation Grid */}
                    <div className="space-y-2">
                      <h5 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 font-mono">
                        Quick OPD Tools
                      </h5>

                      <div className="grid grid-cols-2 gap-2.5">
                        
                        <button
                          onClick={() => setSimScreen('claim')}
                          className="bg-zinc-900 border border-zinc-850 p-3 rounded-xl flex flex-col justify-between hover:bg-zinc-850 text-left transition cursor-pointer group"
                        >
                          <div className="p-1.5 bg-red-950/60 border border-red-900/40 rounded-lg text-red-400 w-fit">
                            <Plus className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-zinc-200 mt-4 group-hover:text-white">Claim OPD</span>
                        </button>

                        <button
                          onClick={() => setSimScreen('chat')}
                          className="bg-zinc-900 border border-zinc-850 p-3 rounded-xl flex flex-col justify-between hover:bg-zinc-850 text-left transition cursor-pointer group"
                        >
                          <div className="p-1.5 bg-indigo-950/60 border border-indigo-900/40 rounded-lg text-indigo-400 w-fit">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-zinc-200 mt-4 group-hover:text-white">AI Health Chat</span>
                        </button>

                        <button
                          onClick={() => setSimScreen('diet')}
                          className="bg-zinc-900 border border-zinc-850 p-3 rounded-xl flex flex-col justify-between hover:bg-zinc-850 text-left transition cursor-pointer group"
                        >
                          <div className="p-1.5 bg-green-950/60 border border-green-900/40 rounded-lg text-green-400 w-fit">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-zinc-200 mt-4 group-hover:text-white">AI Diet Planner</span>
                        </button>

                        <button
                          onClick={() => setSimScreen('wallet')}
                          className="bg-zinc-900 border border-zinc-850 p-3 rounded-xl flex flex-col justify-between hover:bg-zinc-850 text-left transition cursor-pointer group"
                        >
                          <div className="p-1.5 bg-amber-950/60 border border-amber-900/40 rounded-lg text-amber-400 w-fit">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <span className="text-xs font-bold text-zinc-200 mt-4 group-hover:text-white">Refund Wallet</span>
                        </button>

                      </div>
                    </div>

                    {/* Empanelled Hospitals Mini Panel */}
                    <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-bold text-zinc-400">EMPANELLED FACILITIES ({hospitals.length})</span>
                        <span className="text-zinc-600 font-mono">100% Cashless</span>
                      </div>
                      <div className="space-y-1.5">
                        {hospitals.slice(0, 3).map((h) => (
                          <div key={h.id} className="flex items-center gap-2 text-[10px] text-zinc-300">
                            <MapPin className="w-3 h-3 text-zinc-500 shrink-0" />
                            <span className="font-semibold truncate">{h.name}</span>
                            <span className="text-[8px] bg-zinc-800 text-zinc-500 px-1 py-0.2 rounded shrink-0">{h.city}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* BOTTOM NAVIGATION BAR */}
                  <div className="p-2.5 bg-zinc-900 border-t border-zinc-950 flex justify-between items-center text-zinc-500">
                    <button
                      onClick={() => setSimScreen('home')}
                      className={`flex flex-col items-center gap-0.5 w-1/5 cursor-pointer ${simScreen === 'home' ? 'text-indigo-400' : 'hover:text-zinc-300'}`}
                    >
                      <Compass className="w-4 h-4" />
                      <span className="text-[8px] font-bold">Home</span>
                    </button>

                    <button
                      onClick={() => setSimScreen('chat')}
                      className={`flex flex-col items-center gap-0.5 w-1/5 cursor-pointer ${simScreen === 'chat' ? 'text-indigo-400' : 'hover:text-zinc-300'}`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-[8px] font-bold">AI Chat</span>
                    </button>

                    <button
                      onClick={() => setSimScreen('claim')}
                      className={`flex flex-col items-center gap-0.5 w-1/5 cursor-pointer ${simScreen === 'claim' ? 'text-indigo-400' : 'hover:text-zinc-300'}`}
                    >
                      <Plus className="w-4 h-4" />
                      <span className="text-[8px] font-bold">Claim</span>
                    </button>

                    <button
                      onClick={() => setSimScreen('history')}
                      className={`flex flex-col items-center gap-0.5 w-1/5 cursor-pointer ${simScreen === 'history' ? 'text-indigo-400' : 'hover:text-zinc-300'}`}
                    >
                      <HistoryIcon className="w-4 h-4" />
                      <span className="text-[8px] font-bold">History</span>
                    </button>

                    <button
                      onClick={() => setSimScreen('profile')}
                      className={`flex flex-col items-center gap-0.5 w-1/5 cursor-pointer ${simScreen === 'profile' ? 'text-indigo-400' : 'hover:text-zinc-300'}`}
                    >
                      <User className="w-4 h-4" />
                      <span className="text-[8px] font-bold">Profile</span>
                    </button>
                  </div>

                </div>
              )}

              {/* SCREEN: Premium Plans (Razorpay Pricing List) */}
              {simScreen === 'plans' && (
                <div className="flex-1 bg-zinc-950 flex flex-col justify-between overflow-hidden">
                  <div className="p-4 bg-zinc-900 border-b border-zinc-950 flex items-center gap-3">
                    <button onClick={() => setSimScreen('home')} className="text-zinc-400 hover:text-white cursor-pointer">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-xs font-bold text-white">OPD Health Plans</h3>
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
                    
                    <div className="text-center pb-1">
                      <h4 className="text-xs font-extrabold text-white">Secure Cashless Coverage</h4>
                      <p className="text-[10px] text-zinc-500 mt-1">Activate instant cashless OPD refunds within minutes</p>
                    </div>

                    {/* Plan ₹29 */}
                    <div className="border border-zinc-800 bg-zinc-900/60 rounded-xl p-3.5 flex justify-between items-center">
                      <div>
                        <h5 className="text-xs font-extrabold text-white">Bronze Starter</h5>
                        <p className="text-[9px] text-zinc-500 mt-0.5">⭐ 1 OPD Claim Allowance</p>
                        <p className="text-[9px] text-zinc-400 mt-2">Valid for 30 Days coverage</p>
                      </div>
                      <button
                        onClick={() => launchRazorpay('Bronze Starter', 29, 1)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition cursor-pointer shrink-0"
                      >
                        ₹29
                      </button>
                    </div>

                    {/* Plan ₹99 */}
                    <div className="border border-zinc-800 bg-zinc-900/60 rounded-xl p-3.5 flex justify-between items-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-indigo-600 text-[8px] font-bold px-2 py-0.5 rounded-bl">RECOMMENDED</div>
                      <div>
                        <h5 className="text-xs font-extrabold text-white">Silver Regular</h5>
                        <p className="text-[9px] text-indigo-400 mt-0.5">⭐ 4 OPD Claims Allowance</p>
                        <p className="text-[9px] text-zinc-400 mt-2">Free AI health monitoring</p>
                      </div>
                      <button
                        onClick={() => launchRazorpay('Silver Regular', 99, 4)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition cursor-pointer shrink-0"
                      >
                        ₹99
                      </button>
                    </div>

                    {/* Plan ₹999 */}
                    <div className="border border-amber-900/40 bg-amber-950/10 rounded-xl p-3.5 flex justify-between items-center">
                      <div>
                        <h5 className="text-xs font-extrabold text-amber-400">Gold Max Pro</h5>
                        <p className="text-[9px] text-zinc-500 mt-0.5">⭐ Unlimited OPD Claims</p>
                        <p className="text-[9px] text-zinc-400 mt-2">Full VIP health panel access</p>
                      </div>
                      <button
                        onClick={() => launchRazorpay('Gold Max Pro', 999, 99)}
                        className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs px-3.5 py-1.5 rounded-lg transition cursor-pointer shrink-0"
                      >
                        ₹999
                      </button>
                    </div>

                  </div>
                </div>
              )}

              {/* SCREEN: OPD Claim Submission Form */}
              {simScreen === 'claim' && (
                <div className="flex-1 bg-zinc-950 flex flex-col justify-between overflow-hidden">
                  <div className="p-4 bg-zinc-900 border-b border-zinc-950 flex items-center gap-3">
                    <button onClick={() => setSimScreen('home')} className="text-zinc-400 hover:text-white cursor-pointer">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-xs font-bold text-white">Claim OPD Payout</h3>
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
                    {opdRemaining <= 0 && userPlan !== 'Gold Max Pro' ? (
                      <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-4 text-center space-y-3">
                        <Lock className="w-8 h-8 text-red-400 mx-auto" />
                        <h4 className="text-xs font-bold text-white">OPD Claims Locked</h4>
                        <p className="text-[10px] text-zinc-400">
                          You do not have any available claims under your current tier. Subscribe to a Premium Plan to enable instant cashier reimbursements.
                        </p>
                        <button
                          onClick={() => setSimScreen('plans')}
                          className="bg-indigo-600 text-white font-bold text-[10px] px-4 py-2 rounded-lg cursor-pointer"
                        >
                          View Premium Plans
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* QR Code Quick Fill Option */}
                        <div className="bg-gradient-to-r from-indigo-950/40 to-purple-950/40 border border-indigo-900/40 rounded-xl p-3 flex items-center justify-between shadow-inner">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-900/60 flex items-center justify-center border border-indigo-800/60 animate-pulse">
                              <QrCode className="w-4 h-4 text-indigo-400" />
                            </div>
                            <div className="text-left">
                              <h4 className="text-[11px] font-bold text-indigo-200">OPD Receipt QR Quick-Fill</h4>
                              <p className="text-[8px] text-zinc-400">Scan billing QR code to instantly autofill form fields</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setQrScannerOpen(true);
                              setQrScannerTab('camera');
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[9px] px-2.5 py-1.5 rounded-lg transition shrink-0 cursor-pointer flex items-center gap-1 shadow-sm"
                          >
                            <Scan className="w-3 h-3" />
                            Scan Now
                          </button>
                        </div>

                        {/* Hospital Selector */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold tracking-wider uppercase text-zinc-500">
                            Select Facility
                          </label>
                          <select
                            value={claimHospital}
                            onChange={(e) => setClaimHospital(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-xs p-2 text-white focus:outline-none"
                          >
                            {hospitals.map((h) => (
                              <option key={h.id} value={h.id}>
                                {h.name} ({h.city})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Doctor Name */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold tracking-wider uppercase text-zinc-500">
                            Doctor Name &amp; Specialty
                          </label>
                          <input
                            type="text"
                            value={claimDoctor}
                            onChange={(e) => setClaimDoctor(e.target.value)}
                            placeholder="e.g. Dr. Satish Mehta (GP)"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-xs p-2 text-white focus:outline-none"
                          />
                        </div>

                        {/* Receipt Date Picker */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold tracking-wider uppercase text-zinc-500">
                            Consultation / Receipt Date
                          </label>
                          <input
                            type="date"
                            value={claimDate}
                            onChange={(e) => setClaimDate(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-xs p-2 text-white focus:outline-none font-mono"
                          />
                        </div>

                        {/* Bill Amount */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold tracking-wider uppercase text-zinc-500">
                              Bill Amount
                            </label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-2 text-zinc-500 text-xs font-bold">₹</span>
                              <input
                                type="number"
                                value={claimBillAmount}
                                onChange={(e) => setClaimBillAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-xs p-2 pl-6 text-white focus:outline-none font-mono"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold tracking-wider uppercase text-zinc-500">
                              Reimbursement Rate
                            </label>
                            <input
                              type="text"
                              value="100% Cashless"
                              disabled
                              className="w-full bg-zinc-900/60 border border-zinc-850 rounded-lg text-xs p-2 text-emerald-400 font-bold focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Receipt Upload */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold tracking-wider uppercase text-zinc-500">
                            Invoice Receipt Slip
                          </label>
                          
                          <div className="border border-dashed border-zinc-800 bg-zinc-900/40 rounded-xl p-3 text-center cursor-pointer relative hover:border-zinc-700 transition">
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={handleReceiptChange}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            
                            {claimReceiptPreview ? (
                              <div className="space-y-2">
                                <img src={claimReceiptPreview} alt="Bill attachment preview" className="max-h-20 mx-auto rounded border border-zinc-850" />
                                <p className="text-[9px] text-emerald-400 truncate font-semibold font-mono">{claimReceiptName}</p>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <FilePlus className="w-5 h-5 text-zinc-500 mx-auto" />
                                <p className="text-[10px] text-zinc-400 font-semibold">Attach Receipt / Prescription</p>
                                <p className="text-[8px] text-zinc-600 font-mono">Supports PNG, JPG, PDF</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {claimError && (
                          <div className="text-[10px] text-red-400 font-mono bg-red-950/20 border border-red-900/40 p-2 rounded-lg text-center">
                            {claimError}
                          </div>
                        )}

                        <button
                          onClick={submitOpdClaim}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-lg transition shadow-md cursor-pointer animate-pulse-slow"
                        >
                          Submit Cashless OPD Claim
                        </button>

                        {/* QR Scanner Modal Overlay */}
                        {qrScannerOpen && (
                          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3">
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl animate-fade-in">
                              {/* Header */}
                              <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
                                <div className="flex items-center gap-2">
                                  <QrCode className="w-4 h-4 text-indigo-400" />
                                  <h4 className="text-xs font-bold text-white">OPD Receipt QR Scanner</h4>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQrScannerOpen(false);
                                    stopQrCamera();
                                  }}
                                  className="text-zinc-500 hover:text-white transition cursor-pointer p-1 rounded hover:bg-zinc-850"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Tabs */}
                              <div className="flex border-b border-zinc-850 bg-zinc-950/40 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => setQrScannerTab('camera')}
                                  className={`flex-1 py-2.5 font-bold transition border-b-2 ${
                                    qrScannerTab === 'camera'
                                      ? 'border-indigo-500 text-white bg-zinc-900/40'
                                      : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/10'
                                  }`}
                                >
                                  Live Camera Scan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setQrScannerTab('upload')}
                                  className={`flex-1 py-2.5 font-bold transition border-b-2 ${
                                    qrScannerTab === 'upload'
                                      ? 'border-indigo-500 text-white bg-zinc-900/40'
                                      : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/10'
                                  }`}
                                >
                                  Upload QR Image
                                </button>
                              </div>

                              {/* Body */}
                              <div className="p-4 flex-1 flex flex-col justify-center min-h-[220px]">
                                {qrScannerSuccess && (
                                  <div className="text-center py-6 space-y-2">
                                    <div className="w-10 h-10 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center mx-auto text-emerald-400 animate-bounce">
                                      <Check className="w-5 h-5" />
                                    </div>
                                    <p className="text-xs font-bold text-emerald-400">{qrScannerSuccess}</p>
                                  </div>
                                )}

                                {!qrScannerSuccess && qrScannerTab === 'camera' && (
                                  <div className="space-y-3 flex-1 flex flex-col justify-center">
                                    {/* Camera viewport wrapper */}
                                    <div className="relative border border-zinc-800 rounded-xl overflow-hidden aspect-square bg-black flex items-center justify-center">
                                      <div id="qr-scanner-view" className="w-full h-full"></div>
                                      
                                      {!qrIsScanning && !qrScannerError && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 text-[10px] space-y-2 bg-black z-20">
                                          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                                          <span>Initializing high-focus camera...</span>
                                        </div>
                                      )}

                                      {/* Interactive Flash/Torch Toggle Button Overlay */}
                                      {qrIsScanning && (
                                        <button
                                          type="button"
                                          onClick={toggleFlash}
                                          className="absolute top-3 right-3 p-2 bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800/80 backdrop-blur-md rounded-xl text-white shadow-lg cursor-pointer transition z-30"
                                          title="Toggle Camera Flash"
                                        >
                                          {flashOn ? (
                                            <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
                                          ) : (
                                            <ZapOff className="w-4 h-4 text-zinc-400" />
                                          )}
                                        </button>
                                      )}

                                      {/* Active Continuous Auto-Focus Status Light Overlay */}
                                      {qrIsScanning && (
                                        <div className="absolute top-3 left-3 bg-zinc-950/80 border border-zinc-800/80 backdrop-blur-md rounded-xl px-2.5 py-1 flex items-center gap-1.5 shadow-lg select-none z-30">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute"></span>
                                          <span className="text-[8px] font-mono font-black text-emerald-400 uppercase tracking-widest">
                                            AF-Continuous
                                          </span>
                                        </div>
                                      )}

                                      {/* Intelligent Reticle Corners and Autofocus Status Frame */}
                                      {qrIsScanning && (
                                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                                          <div className="w-3/5 h-3/5 border border-indigo-500/20 rounded-xl relative flex items-center justify-center">
                                            {/* Beautiful framing brackets */}
                                            <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-indigo-400 rounded-tl"></div>
                                            <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-indigo-400 rounded-tr"></div>
                                            <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-indigo-400 rounded-bl"></div>
                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-indigo-400 rounded-br"></div>
                                            
                                            {/* Real-time scanning indicator lines */}
                                            <div className="w-full h-[1px] bg-red-500/40 absolute top-1/2 left-0 animate-pulse"></div>

                                            {/* Micro-target dot in center */}
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 animate-ping"></div>

                                            {/* Live focus lock notification banner inside viewfinder */}
                                            <div className="absolute -bottom-10 bg-zinc-950/90 border border-zinc-800/60 backdrop-blur-sm rounded-lg px-2 py-0.5 shadow-md flex items-center gap-1">
                                              <span className="text-[7.5px] text-zinc-300 font-mono tracking-wide">
                                                {scanProgress < 50 ? "Locking auto-focus..." : "Focus lock [AUTO-CAP]"}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Manual Shutter Shutter Trigger Button overlay */}
                                      {qrIsScanning && !isCapturing && (
                                        <button
                                          type="button"
                                          onClick={triggerAutoCapture}
                                          className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-white hover:bg-zinc-100 text-zinc-950 p-2.5 rounded-full shadow-2xl border-2 border-zinc-300/40 hover:scale-105 active:scale-95 transition cursor-pointer z-30 flex items-center justify-center"
                                          title="Instant Snapshot"
                                        >
                                          <Camera className="w-4 h-4 text-zinc-950" />
                                        </button>
                                      )}

                                      {/* Progressive Scanning Stabilization Status Bar */}
                                      {qrIsScanning && (
                                        <div className="absolute bottom-3 left-3 right-3 p-2 bg-zinc-950/85 border border-zinc-800/60 backdrop-blur-md rounded-xl shadow-lg z-30 flex items-center justify-between">
                                          <div className="flex items-center gap-1.5">
                                            <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                                            <span className="text-[8px] text-zinc-300 font-mono font-bold">
                                              {scanProgress < 100 ? `Auto-focus stabilization` : `Capture complete!`}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <div className="w-20 bg-zinc-800 h-1 rounded-full overflow-hidden">
                                              <div 
                                                className="bg-indigo-500 h-full transition-all duration-200" 
                                                style={{ width: `${scanProgress}%` }}
                                              ></div>
                                            </div>
                                            <span className="text-[8px] font-mono text-zinc-400 font-black">{scanProgress}%</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-[9px] text-center text-zinc-400 font-mono">
                                      Hold the receipt stable. Autofocus will capture it or read QR instantly.
                                    </p>
                                  </div>
                                )}

                                {!qrScannerSuccess && qrScannerTab === 'upload' && (
                                  <div className="space-y-3">
                                    <div className="border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 rounded-xl p-6 text-center cursor-pointer relative transition">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleQrFileUpload}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                      />
                                      <FilePlus className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
                                      <p className="text-[11px] text-zinc-300 font-semibold">Select QR Receipt Image</p>
                                      <p className="text-[8px] text-zinc-500 font-mono mt-1">Supports PNG, JPG, WEBP</p>
                                    </div>
                                    <p className="text-[9px] text-center text-zinc-400">
                                      Or drop an invoice image containing a valid clinical receipt QR code.
                                    </p>
                                  </div>
                                )}

                                {qrScannerError && (
                                  <div className="mt-3 text-[9px] text-amber-400 font-mono bg-amber-950/20 border border-amber-900/30 p-2 rounded-lg text-center leading-relaxed">
                                    {qrScannerError}
                                  </div>
                                )}
                              </div>

                              {/* Testing Simulator Presets Panel */}
                              <div className="p-3 border-t border-zinc-800 bg-zinc-950/60 max-h-[180px] overflow-y-auto">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide">Developer Testing Simulator</span>
                                </div>
                                <p className="text-[8px] text-zinc-500 leading-normal mb-2">
                                  Since standard camera frame streaming requires sandbox SSL and camera hardware, we generated high-fidelity sample receipts for immediate validation:
                                </p>
                                
                                <div className="space-y-1.5">
                                  {/* Preset 1: Apollo */}
                                  <div className="bg-zinc-900 border border-zinc-850 rounded-lg p-2 flex items-center justify-between text-left">
                                    <div>
                                      <p className="text-[9px] font-bold text-indigo-300">Apollo Consultation Receipt</p>
                                      <p className="text-[8px] text-zinc-400">Dr. Ramesh Nair • ₹1,850 • July 3</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <a
                                        href="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=%7B%22hospitalId%22%3A%221%22%2C%22doctorName%22%3A%22Dr.+Ramesh+Nair+(Cardiologist)%22%2C%22billAmount%22%3A1850%2C%22date%22%3A%222026-07-03%22%7D"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-[8px] px-1.5 py-1 rounded transition border border-zinc-700 font-bold"
                                        title="Open QR image to scan with camera or upload"
                                      >
                                        View QR
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => handleScannedResult('{"hospitalId":"1","doctorName":"Dr. Ramesh Nair (Cardiologist)","billAmount":1850,"date":"2026-07-03"}')}
                                        className="bg-indigo-950 border border-indigo-800 text-indigo-300 hover:bg-indigo-900 text-[8px] px-1.5 py-1 rounded transition font-bold cursor-pointer"
                                      >
                                        Apply Scan
                                      </button>
                                    </div>
                                  </div>

                                  {/* Preset 2: Fortis */}
                                  <div className="bg-zinc-900 border border-zinc-850 rounded-lg p-2 flex items-center justify-between text-left">
                                    <div>
                                      <p className="text-[9px] font-bold text-amber-300">Fortis Pediatrician Receipt</p>
                                      <p className="text-[8px] text-zinc-400">Dr. Anita Desai • ₹1,200 • July 2</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <a
                                        href="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=%7B%22hospitalId%22%3A%222%22%2C%22doctorName%22%3A%22Dr.+Anita+Desai+(Pediatrician)%22%2C%22billAmount%22%3A1200%2C%22date%22%3A%222026-07-02%22%7D"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-[8px] px-1.5 py-1 rounded transition border border-zinc-700 font-bold"
                                        title="Open QR image to scan with camera or upload"
                                      >
                                        View QR
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => handleScannedResult('{"hospitalId":"2","doctorName":"Dr. Anita Desai (Pediatrician)","billAmount":1200,"date":"2026-07-02"}')}
                                        className="bg-indigo-950 border border-indigo-800 text-indigo-300 hover:bg-indigo-900 text-[8px] px-1.5 py-1 rounded transition font-bold cursor-pointer"
                                      >
                                        Apply Scan
                                      </button>
                                    </div>
                                  </div>

                                  {/* Preset 3: Max */}
                                  <div className="bg-zinc-900 border border-zinc-850 rounded-lg p-2 flex items-center justify-between text-left">
                                    <div>
                                      <p className="text-[9px] font-bold text-emerald-300">Max OPD consultation</p>
                                      <p className="text-[8px] text-zinc-400">Dr. Sunil Gupta • ₹650 • July 1</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <a
                                        href="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=%7B%22hospitalId%22%3A%223%22%2C%22doctorName%22%3A%22Dr.+Sunil+Gupta+(GP)%22%2C%22billAmount%22%3A650%2C%22date%22%3A%222026-07-01%22%7D"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-[8px] px-1.5 py-1 rounded transition border border-zinc-700 font-bold"
                                        title="Open QR image to scan with camera or upload"
                                      >
                                        View QR
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => handleScannedResult('{"hospitalId":"3","doctorName":"Dr. Sunil Gupta (GP)","billAmount":650,"date":"2026-07-01"}')}
                                        className="bg-indigo-950 border border-indigo-800 text-indigo-300 hover:bg-indigo-900 text-[8px] px-1.5 py-1 rounded transition font-bold cursor-pointer"
                                      >
                                        Apply Scan
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Image Crop, Rotation & Zoom Editor Modal Overlay */}
                        {isCropModalOpen && cropSourceImage && (
                          <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-3 animate-fade-in animate-none">
                            <div className="bg-zinc-900 border border-zinc-850 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl">
                              
                              {/* Header */}
                              <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950 text-left">
                                <div className="flex items-center gap-2">
                                  <div className="p-1 bg-indigo-950 border border-indigo-800/40 rounded-lg">
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-white">OPD Receipt Editor</h4>
                                    <p className="text-[8px] text-zinc-500 font-mono">Crop, rotate, and optimize for OCR scanning</p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setIsCropModalOpen(false)}
                                  className="text-zinc-500 hover:text-white transition cursor-pointer p-1 rounded hover:bg-zinc-850"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Editor Canvas Area */}
                              <div className="p-4 flex flex-col items-center space-y-4 bg-zinc-950/40 border-b border-zinc-850">
                                
                                <div 
                                  ref={cropContainerRef}
                                  className="relative w-[280px] h-[340px] overflow-hidden bg-zinc-950 rounded-xl border border-zinc-850 flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                                  onMouseDown={handleMouseDown}
                                  onMouseMove={handleMouseMove}
                                  onMouseUp={handleMouseUp}
                                  onMouseLeave={handleMouseUp}
                                  onTouchStart={handleTouchStart}
                                  onTouchMove={handleTouchMove}
                                  onTouchEnd={handleTouchEnd}
                                  onWheel={handleWheel}
                                >
                                  {/* Original Image transformed based on state */}
                                  <img
                                    ref={imgRef}
                                    src={cropSourceImage}
                                    alt="Uploaded OPD receipt preview"
                                    onLoad={handleImageLoad}
                                    className="absolute max-w-[260px] max-h-[320px] object-contain pointer-events-none origin-center"
                                    style={{
                                      transform: `translate(${cropTranslate.x}px, ${cropTranslate.y}px) rotate(${cropRotation}deg) scale(${cropZoom})`,
                                      transition: isDragging ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)'
                                    }}
                                    referrerPolicy="no-referrer"
                                  />

                                  {/* Custom Outward Dark Shadows Outside Crop Area */}
                                  <div className="absolute inset-0 pointer-events-none z-10">
                                    {/* Top mask */}
                                    <div 
                                      className="absolute left-0 top-0 right-0 bg-black/65 transition-all duration-100" 
                                      style={{ height: `${isFreeCrop ? cropBox.y : 30}px` }} 
                                    />
                                    {/* Bottom mask */}
                                    <div 
                                      className="absolute left-0 right-0 bottom-0 bg-black/65 transition-all duration-100" 
                                      style={{ top: `${isFreeCrop ? cropBox.y + cropBox.height : 310}px` }} 
                                    />
                                    {/* Left mask */}
                                    <div 
                                      className="absolute left-0 bg-black/65 transition-all duration-100" 
                                      style={{ 
                                        top: `${isFreeCrop ? cropBox.y : 30}px`, 
                                        height: `${isFreeCrop ? cropBox.height : 280}px`, 
                                        width: `${isFreeCrop ? cropBox.x : 30}px` 
                                      }} 
                                    />
                                    {/* Right mask */}
                                    <div 
                                      className="absolute right-0 bg-black/65 transition-all duration-100" 
                                      style={{ 
                                        top: `${isFreeCrop ? cropBox.y : 30}px`, 
                                        height: `${isFreeCrop ? cropBox.height : 280}px`, 
                                        left: `${isFreeCrop ? cropBox.x + cropBox.width : 250}px` 
                                      }} 
                                    />
                                  </div>

                                  {/* Crop Rectangle Frame */}
                                  <div 
                                    className="absolute border-2 border-indigo-400 rounded-lg pointer-events-none z-20 transition-all duration-100"
                                    style={{ 
                                      left: `${isFreeCrop ? cropBox.x : 30}px`,
                                      top: `${isFreeCrop ? cropBox.y : 30}px`,
                                      width: `${isFreeCrop ? cropBox.width : 220}px`,
                                      height: `${isFreeCrop ? cropBox.height : 280}px`,
                                    }}
                                  >
                                    {/* Corner framing anchors */}
                                    <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-indigo-400 rounded-tl-sm"></div>
                                    <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-indigo-400 rounded-tr-sm"></div>
                                    <div className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-indigo-400 rounded-bl-sm"></div>
                                    <div className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-indigo-400 rounded-br-sm"></div>
                                    
                                    {/* Rule of Thirds grid lines inside crop area */}
                                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-20 pointer-events-none">
                                      <div className="border-r border-b border-indigo-300/40"></div>
                                      <div className="border-r border-b border-indigo-300/40"></div>
                                      <div className="border-b border-indigo-300/40"></div>
                                      <div className="border-r border-b border-indigo-300/40"></div>
                                      <div className="border-r border-b border-indigo-300/40"></div>
                                      <div className="border-b border-indigo-300/40"></div>
                                      <div className="border-r border-indigo-300/40"></div>
                                      <div className="border-r border-indigo-300/40"></div>
                                      <div></div>
                                    </div>

                                    {/* Interactive Handle Nodes (Only active in Free Crop Mode) */}
                                    {isFreeCrop && (
                                      <>
                                        {/* Top-Left handle */}
                                        <div 
                                          className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-nwse-resize z-30 pointer-events-auto shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition"
                                          onMouseDown={(e) => handleHandleMouseDown('nw', e)}
                                          onTouchStart={(e) => handleHandleTouchStart('nw', e)}
                                        />
                                        {/* Top-Right handle */}
                                        <div 
                                          className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-nesw-resize z-30 pointer-events-auto shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition"
                                          onMouseDown={(e) => handleHandleMouseDown('ne', e)}
                                          onTouchStart={(e) => handleHandleTouchStart('ne', e)}
                                        />
                                        {/* Bottom-Left handle */}
                                        <div 
                                          className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-nesw-resize z-30 pointer-events-auto shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition"
                                          onMouseDown={(e) => handleHandleMouseDown('sw', e)}
                                          onTouchStart={(e) => handleHandleTouchStart('sw', e)}
                                        />
                                        {/* Bottom-Right handle */}
                                        <div 
                                          className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-indigo-500 rounded-full cursor-nwse-resize z-30 pointer-events-auto shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition"
                                          onMouseDown={(e) => handleHandleMouseDown('se', e)}
                                          onTouchStart={(e) => handleHandleTouchStart('se', e)}
                                        />
                                      </>
                                    )}
                                  </div>

                                  {/* HUD Instructions */}
                                  <div className="absolute bottom-2 left-2 right-2 pointer-events-none z-30 text-center bg-black/60 backdrop-blur-sm py-1 px-1.5 rounded border border-zinc-800/40">
                                    <p className="text-[7.5px] text-zinc-300 font-mono">
                                      {isFreeCrop ? 'Drag handles to crop • Drag receipt to pan • Pinch/Scroll' : 'Drag receipt to pan inside standard box • Pinch/Scroll'}
                                    </p>
                                  </div>
                                </div>

                                {/* Auto-straightened banner notice */}
                                {autoStraightenedAngle !== null && Math.abs(autoStraightenedAngle) > 0.01 && (
                                  <div className="w-full flex items-center justify-between bg-emerald-950/40 border border-emerald-900/50 rounded-lg py-1.5 px-2.5 text-[9px] text-emerald-400 font-mono">
                                    <div className="flex items-center gap-1.5">
                                      <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                                      <span>Straightened skew by {-autoStraightenedAngle.toFixed(1)}°</span>
                                    </div>
                                    <button 
                                      type="button" 
                                      onClick={() => {
                                        setCropRotation(0);
                                        setAutoStraightenedAngle(null);
                                      }}
                                      className="underline hover:text-white transition cursor-pointer font-bold"
                                    >
                                      Undo
                                    </button>
                                  </div>
                                )}

                                {/* Controls panel */}
                                <div className="w-full space-y-3 text-left">
                                  
                                  {/* Crop Mode Selection and Document Edge Detection */}
                                  <div className="space-y-1.5">
                                    <div className="flex justify-between items-center text-[9px] text-zinc-400 font-mono">
                                      <span className="font-bold uppercase tracking-wider">Crop Boundaries Mode</span>
                                      <span className="text-zinc-500">Manual / Smart Detection</span>
                                    </div>
                                    <div className="flex gap-2">
                                      <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 flex">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setIsFreeCrop(false);
                                            setCropBox({ x: 30, y: 30, width: 220, height: 280 });
                                          }}
                                          className={`flex-1 py-1 text-[9px] font-bold rounded transition cursor-pointer ${!isFreeCrop ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
                                        >
                                          Locked Doc Standard
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setIsFreeCrop(true)}
                                          className={`flex-1 py-1 text-[9px] font-bold rounded transition cursor-pointer ${isFreeCrop ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
                                        >
                                          Free Custom Crop
                                        </button>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (imgRef.current) {
                                            runEdgeDetection(imgRef.current);
                                          }
                                        }}
                                        className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-indigo-400 hover:text-indigo-300 font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition text-[9px] cursor-pointer"
                                        title="Auto scan document boundaries"
                                      >
                                        <Scan className="w-3.5 h-3.5" />
                                        <span>Scan Edges</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Zoom scale */}
                                  <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[9px] text-zinc-400 font-mono">
                                      <span className="font-bold uppercase tracking-wider">Pinch / Zoom Scale</span>
                                      <span className="text-indigo-400 font-bold">{Math.round(cropZoom * 100)}%</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setCropZoom(prev => Math.max(1, prev - 0.25))}
                                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-1 rounded border border-zinc-700/50 cursor-pointer text-xs font-mono font-bold w-6 h-6 flex items-center justify-center"
                                        title="Zoom Out"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="range"
                                        min="1"
                                        max="4"
                                        step="0.05"
                                        value={cropZoom}
                                        onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                                        className="flex-1 accent-indigo-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setCropZoom(prev => Math.min(4, prev + 0.25))}
                                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-1 rounded border border-zinc-700/50 cursor-pointer text-xs font-mono font-bold w-6 h-6 flex items-center justify-center"
                                        title="Zoom In"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  {/* Rotation control slider */}
                                  <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[9px] text-zinc-400 font-mono">
                                      <span className="font-bold uppercase tracking-wider">Rotate &amp; Align</span>
                                      <span className="text-indigo-400 font-bold">{Math.round(cropRotation)}°</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="range"
                                        min="-180"
                                        max="180"
                                        step="1"
                                        value={cropRotation}
                                        onChange={(e) => setCropRotation(parseInt(e.target.value))}
                                        className="flex-1 accent-indigo-500 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCropRotation(prev => {
                                            const normalized = Math.round(prev);
                                            return (normalized + 90) % 360;
                                          });
                                        }}
                                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700/50 cursor-pointer text-[10px] font-mono font-bold h-6 flex items-center justify-center"
                                        title="Rotate 90 degrees CW"
                                      >
                                        +90°
                                      </button>
                                    </div>
                                  </div>

                                  {/* Reset & Fine-Tuning actions row */}
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setCropRotation(0)}
                                      className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-white font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition text-[9px]"
                                    >
                                      <RefreshCw className="w-3 h-3 text-red-400" />
                                      <span>Reset Rotation</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCropZoom(1);
                                        setCropRotation(0);
                                        setCropTranslate({ x: 0, y: 0 });
                                        setCropBox({ x: 30, y: 30, width: 220, height: 280 });
                                        setIsFreeCrop(false);
                                        setAutoStraightenedAngle(null);
                                      }}
                                      className="flex-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-white font-bold py-1.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition text-[9px]"
                                    >
                                      <span>Reset Entire Frame</span>
                                    </button>
                                  </div>

                                  {/* Document OCR filter toggle */}
                                  <div className="border border-zinc-800 bg-zinc-900/30 rounded-xl p-2.5 flex items-start gap-2.5">
                                    <input
                                      id="ocr-enhance-toggle"
                                      type="checkbox"
                                      checked={isEnhanced}
                                      onChange={(e) => setIsEnhanced(e.target.checked)}
                                      className="mt-0.5 rounded border-zinc-750 text-indigo-600 focus:ring-indigo-500 accent-indigo-500 cursor-pointer h-3.5 w-3.5"
                                    />
                                    <label htmlFor="ocr-enhance-toggle" className="flex-1 cursor-pointer select-none">
                                      <span className="block text-[10px] font-bold text-white flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 text-indigo-400 animate-pulse" />
                                        Auto-Enhance Document OCR Filter
                                      </span>
                                      <span className="block text-[8px] text-zinc-500 leading-normal mt-0.5">
                                        Removes shadows, flattens illumination, and stretches text contrast for high-fidelity OCR scanning &amp; instant claims approval.
                                      </span>
                                    </label>
                                  </div>

                                </div>
                              </div>

                              {/* Footer Actions */}
                              <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setIsCropModalOpen(false)}
                                  className="flex-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-800 text-[10px] font-bold py-2 rounded-xl cursor-pointer transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={applyCropAndOptimize}
                                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold py-2 rounded-xl cursor-pointer transition flex items-center justify-center gap-1 shadow-lg shadow-indigo-950/20"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Crop &amp; Optimize</span>
                                </button>
                              </div>

                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* SCREEN: Claim Submission Confirmation */}
              {simScreen === 'claim_confirmation' && submittedClaim && (
                <div className="flex-1 bg-zinc-950 flex flex-col justify-between overflow-hidden relative">
                  <div className="p-4 bg-zinc-900 border-b border-zinc-950 flex items-center gap-3">
                    <button onClick={() => setSimScreen('home')} className="text-zinc-400 hover:text-white cursor-pointer">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-xs font-bold text-white font-sans">Claim Registered</h3>
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {/* Visual checkmark animation */}
                    <div className="py-2 flex flex-col items-center justify-center text-center">
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
                        className="w-14 h-14 rounded-full bg-emerald-950 border-2 border-emerald-500/80 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40"
                      >
                        <Check className="w-8 h-8" />
                      </motion.div>
                      <h4 className="text-sm font-black text-white mt-3 tracking-tight">Claim Registered Successfully</h4>
                      <p className="text-[10px] text-zinc-400 mt-1 max-w-[240px] mx-auto">
                        Your reimbursement request has been queued and is active for verification.
                      </p>
                    </div>

                    {/* Claim Details Card */}
                    <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-3 text-left space-y-3.5">
                      <div className="flex justify-between items-center pb-2.5 border-b border-zinc-800">
                        <div>
                          <p className="text-[8px] text-zinc-500 font-mono tracking-wider uppercase">Claim ID</p>
                          <p className="text-xs font-bold text-indigo-400 font-mono">{submittedClaim.id}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] text-zinc-500 font-mono uppercase">Status</p>
                          <span className="inline-block text-[8px] bg-amber-950/60 text-amber-400 px-2 py-0.5 rounded-full font-mono font-bold border border-amber-900/40">
                            {submittedClaim.status}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-[10px]">
                        <div>
                          <p className="text-[8px] text-zinc-500 font-mono uppercase">Hospital Facility</p>
                          <p className="font-semibold text-zinc-200 mt-0.5 truncate">{submittedClaim.hospitalName}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-zinc-500 font-mono uppercase">Diagnosing Doctor</p>
                          <p className="font-semibold text-zinc-200 mt-0.5 truncate">{submittedClaim.doctorName}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-zinc-500 font-mono uppercase">Consultation Date</p>
                          <p className="font-semibold text-zinc-200 mt-0.5 font-mono">{submittedClaim.date}</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-zinc-500 font-mono uppercase">Amount Requested</p>
                          <p className="font-black text-white font-mono mt-0.5 text-xs text-indigo-300">₹{submittedClaim.billAmount}</p>
                        </div>
                      </div>

                      {submittedClaim.receiptPreview && (
                        <div className="pt-2 border-t border-zinc-800 flex items-center gap-2">
                          <img src={submittedClaim.receiptPreview} alt="Receipt Attachment" className="w-8 h-8 rounded border border-zinc-800 object-cover" />
                          <div className="overflow-hidden">
                            <p className="text-[8px] text-zinc-500 font-mono uppercase">Attached Receipt Document</p>
                            <p className="text-[9px] text-zinc-400 font-semibold font-mono truncate">{submittedClaim.receiptName}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Timeline Tracker */}
                    <div className="bg-zinc-900/30 border border-zinc-850 rounded-xl p-3 text-left">
                      <h5 className="text-[9px] font-bold tracking-wider text-zinc-500 uppercase font-mono mb-2.5">Processing Timeline</h5>
                      <div className="relative pl-4 border-l border-zinc-800 space-y-3 text-[10px]">
                        <div className="relative">
                          <div className="absolute -left-[19px] top-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <p className="font-semibold text-zinc-200">Reimbursement Filed</p>
                          <p className="text-[8px] text-zinc-500">Instance logged and securely stored in cloud Firestore database.</p>
                        </div>
                        <div className="relative">
                          <div className="absolute -left-[19px] top-1 w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                          <p className="font-semibold text-zinc-200">Audit in Queue</p>
                          <p className="text-[8px] text-zinc-500">OPD medical bill &amp; diagnosing doctor verified by reviewer.</p>
                        </div>
                        <div className="relative">
                          <div className="absolute -left-[19px] top-1 w-1.5 h-1.5 rounded-full bg-zinc-800" />
                          <p className="font-semibold text-zinc-200">Instant Wallet Payout</p>
                          <p className="text-[8px] text-zinc-500">On approval, 100% cashless amount will instantly load into Refund Wallet.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-900/50 border-t border-zinc-950 space-y-2">
                    <button
                      onClick={() => setSimScreen('home')}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-lg transition text-center block cursor-pointer"
                    >
                      Return to Dashboard
                    </button>
                    <button
                      onClick={() => setSimScreen('history')}
                      className="w-full bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white border border-zinc-800 font-bold text-xs py-2 rounded-lg transition text-center block cursor-pointer"
                    >
                      View Claims History
                    </button>
                  </div>
                </div>
              )}

              {/* SCREEN: Notifications Center */}
              {simScreen === 'notifications' && (
                <div className="flex-1 bg-zinc-950 flex flex-col justify-between overflow-hidden">
                  <div className="p-4 bg-zinc-900 border-b border-zinc-950 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setSimScreen('home')} className="text-zinc-400 hover:text-white cursor-pointer">
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <h3 className="text-xs font-bold text-white">System Notifications</h3>
                    </div>
                    {appNotifications.length > 0 && (
                      <button
                        onClick={async () => {
                          try {
                            const updatedList = await Promise.all(
                              appNotifications.map(async (n) => {
                                if (!n.read) {
                                  const updated = { ...n, read: true };
                                  await saveNotification(updated);
                                  return updated;
                                }
                                return n;
                              })
                            );
                            setAppNotifications(updatedList);
                          } catch (err) {
                            console.error('Failed to mark notifications as read:', err);
                          }
                        }}
                        className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto">
                    {appNotifications.length === 0 ? (
                      /* PROFESSIONAL EMPTY STATE: NOTIFICATIONS */
                      <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8 space-y-3.5">
                        <div className="w-12 h-12 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-zinc-500">
                          <Bell className="w-5 h-5" />
                        </div>
                        <div className="space-y-1 text-center">
                          <h4 className="text-xs font-bold text-zinc-300">Your Inbox is Clean</h4>
                          <p className="text-[10px] text-zinc-500 max-w-[220px] mx-auto leading-relaxed">
                            You have no new alerts. Policy updates, claim status changes, and system broadcasts will appear here.
                          </p>
                        </div>
                        <button
                          onClick={() => setSimScreen('home')}
                          className="bg-zinc-900 hover:bg-zinc-850 text-zinc-300 hover:text-white border border-zinc-800 text-[10px] font-bold px-4 py-1.5 rounded-lg transition cursor-pointer"
                        >
                          Back to Home
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {appNotifications.map((n) => {
                          const isClaimApprove = n.title.includes('Approved');
                          const isClaimReject = n.title.includes('Correction') || n.title.includes('Rejected');
                          return (
                            <div
                              key={n.id}
                              onClick={async () => {
                                if (!n.read) {
                                  const updated = { ...n, read: true };
                                  try {
                                    await saveNotification(updated);
                                    setAppNotifications(prev => prev.map(item => item.id === n.id ? updated : item));
                                  } catch (err) {
                                    console.error('Failed to mark read:', err);
                                  }
                                }
                              }}
                              className={`p-3 rounded-xl border transition duration-200 text-left relative ${
                                n.read
                                  ? 'bg-zinc-900/30 border-zinc-900/60'
                                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-750'
                              }`}
                            >
                              {!n.read && (
                                <span className="absolute top-3.5 right-3 w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                              )}
                              <div className="flex gap-2.5">
                                <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs mt-0.5 ${
                                  isClaimApprove
                                    ? 'bg-emerald-950/60 border border-emerald-900/50 text-emerald-400'
                                    : isClaimReject
                                    ? 'bg-red-950/60 border border-red-900/50 text-red-400'
                                    : 'bg-indigo-950/60 border border-indigo-900/50 text-indigo-400'
                                }`}>
                                  {isClaimApprove ? (
                                    <CheckCircle className="w-4 h-4" />
                                  ) : isClaimReject ? (
                                    <AlertCircle className="w-4 h-4" />
                                  ) : (
                                    <Bell className="w-4 h-4" />
                                  )}
                                </div>
                                <div className="space-y-1 overflow-hidden">
                                  <h4 className="text-[10px] font-bold text-zinc-200 leading-snug">{n.title}</h4>
                                  <p className="text-[9px] text-zinc-400 leading-normal">{n.message}</p>
                                  <p className="text-[8px] text-zinc-500 font-mono pt-1">{n.date}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SCREEN: AI Chat Assistant (Generative Live Feed) */}
              {simScreen === 'chat' && (
                <div className="flex-1 bg-zinc-950 flex flex-col justify-between overflow-hidden">
                  <div className="p-4 bg-zinc-900 border-b border-zinc-950 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSimScreen('home')} className="text-zinc-400 hover:text-white cursor-pointer">
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <h3 className="text-xs font-bold text-white">AI Health Advisor</h3>
                    </div>
                    {chatMessages.length > 1 && (
                      <button
                        onClick={() => exportToMarkdown('AI Chat Dialogue Transcript', 'Interactive App Live Chat', chatMessages.map(m => `**${m.role.toUpperCase()}:** ${m.text}`).join('\n\n'))}
                        className="text-[9px] text-indigo-400 font-bold hover:underline"
                        title="Download Dialogue Log"
                      >
                        Export Chat
                      </button>
                    )}
                  </div>

                  {/* Messages Feed */}
                  <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5">
                    {chatMessages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex flex-col max-w-[85%] ${
                          msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                        }`}
                      >
                        <div
                          className={`p-2.5 rounded-2xl text-xs ${
                            msg.role === 'user'
                              ? 'bg-indigo-600 text-white rounded-tr-none'
                              : 'bg-zinc-900 text-zinc-300 rounded-tl-none border border-zinc-850'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <span className="text-[8px] text-zinc-600 mt-1 font-mono">{msg.timestamp}</span>
                      </div>
                    ))}

                    {chatLoading && (
                      <div className="flex items-center gap-1.5 p-2 bg-zinc-900 rounded-xl w-fit text-[10px] text-zinc-400 font-mono animate-pulse">
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-100" />
                        <span>Gemini is clinical formulating...</span>
                      </div>
                    )}
                  </div>

                  {/* Chat Input */}
                  <div className="p-3 bg-zinc-900 border-t border-zinc-950 flex items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                      placeholder="Ask health or policy query..."
                      disabled={chatLoading}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    />
                    <button
                      onClick={handleSendChatMessage}
                      disabled={chatLoading || !chatInput.trim()}
                      className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 cursor-pointer disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* SCREEN: Diet Planner Form & AI Generation */}
              {simScreen === 'diet' && (
                <div className="flex-1 bg-zinc-950 flex flex-col justify-between overflow-hidden">
                  <div className="p-4 bg-zinc-900 border-b border-zinc-950 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSimScreen('home')} className="text-zinc-400 hover:text-white cursor-pointer">
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <h3 className="text-xs font-bold text-white">AI Diet Planner</h3>
                    </div>
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
                    {!generatedDiet ? (
                      <>
                        <p className="text-[10px] text-zinc-500 text-center">
                          Powered by the server-side Gemini structured AI nutritionist. Enter your metrics to construct your plan.
                        </p>

                        {/* Metric Fields */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold tracking-wider uppercase text-zinc-500">Age</label>
                            <input
                              type="number"
                              value={dietAge}
                              onChange={(e) => setDietAge(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-xs p-2 text-white focus:outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold tracking-wider uppercase text-zinc-500">Height (cm)</label>
                            <input
                              type="number"
                              value={dietHeight}
                              onChange={(e) => setDietHeight(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-xs p-2 text-white focus:outline-none font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold tracking-wider uppercase text-zinc-500">Weight (kg)</label>
                            <input
                              type="number"
                              value={dietWeight}
                              onChange={(e) => setDietWeight(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-xs p-2 text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Co-morbidities & Conditions */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold tracking-wider uppercase text-zinc-500">Diabetes Status</label>
                            <select
                              value={dietDiabetes}
                              onChange={(e) => setDietDiabetes(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] p-2 text-white focus:outline-none"
                            >
                              <option value="No">No (Normal Glycemia)</option>
                              <option value="Pre-Diabetic">Pre-Diabetic</option>
                              <option value="Type 1">Type 1 (Insulin Dep)</option>
                              <option value="Type 2">Type 2 (Insulin Res)</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-bold tracking-wider uppercase text-zinc-500">Blood Pressure</label>
                            <select
                              value={dietBP}
                              onChange={(e) => setDietBP(e.target.value)}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] p-2 text-white focus:outline-none"
                            >
                              <option value="No">No (Normal BP)</option>
                              <option value="High">High BP (Hypertension)</option>
                              <option value="Low">Low BP (Hypotension)</option>
                            </select>
                          </div>
                        </div>

                        {/* Diet Preferences */}
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold tracking-wider uppercase text-zinc-500">Dietary Profile</label>
                          <div className="grid grid-cols-3 gap-1">
                            {['Vegetarian', 'Vegan', 'Non-Vegetarian'].map((t) => (
                              <button
                                key={t}
                                onClick={() => setDietType(t)}
                                className={`text-[9px] py-1.5 border rounded-lg cursor-pointer ${
                                  dietType === t
                                    ? 'bg-emerald-950/60 border-emerald-500/80 text-emerald-400 font-semibold'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                                }`}
                              >
                                {t.replace('Vegetarian', 'Veg')}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Fitness Goals */}
                        <div className="space-y-1">
                          <label className="text-[8px] font-bold tracking-wider uppercase text-zinc-500">Fitness Core Goal</label>
                          <select
                            value={dietGoal}
                            onChange={(e) => setDietGoal(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-xs p-2 text-white focus:outline-none"
                          >
                            <option value="Weight Loss">Weight Loss &amp; Slimming</option>
                            <option value="Muscle Gain">Muscle Gain &amp; Protein Bulking</option>
                            <option value="Balanced Fitness">Balanced Everyday Health</option>
                          </select>
                        </div>

                        <button
                          onClick={handleGenerateDiet}
                          disabled={dietLoading}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          {dietLoading ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Structuring with Gemini...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Generate Personalized Diet</span>
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <div className="space-y-3.5">
                        <div className="bg-emerald-950/20 border border-emerald-900/40 p-3 rounded-xl flex justify-between items-center">
                          <div>
                            <span className="text-[8px] uppercase tracking-wider font-bold text-emerald-400 font-mono">CALORIES LOADED</span>
                            <h4 className="text-xs font-bold text-white mt-0.5">{generatedDiet.calories} Kcal / Day</h4>
                          </div>
                          <button
                            onClick={() => setGeneratedDiet(null)}
                            className="text-[9px] font-bold text-zinc-400 hover:text-white"
                          >
                            New Plan
                          </button>
                        </div>

                        {/* Detailed Meals Grid */}
                        <div className="space-y-2.5 text-xs">
                          <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-850">
                            <span className="font-bold text-indigo-400 text-[10px]">🍳 Breakfast</span>
                            <p className="text-zinc-300 text-[10px] mt-1">{generatedDiet.meals.breakfast}</p>
                          </div>
                          <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-850">
                            <span className="font-bold text-indigo-400 text-[10px]">🍱 Lunch</span>
                            <p className="text-zinc-300 text-[10px] mt-1">{generatedDiet.meals.lunch}</p>
                          </div>
                          <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-850">
                            <span className="font-bold text-indigo-400 text-[10px]">🍲 Dinner</span>
                            <p className="text-zinc-300 text-[10px] mt-1">{generatedDiet.meals.dinner}</p>
                          </div>
                          <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-850">
                            <span className="font-bold text-indigo-400 text-[10px]">🥜 Snacks</span>
                            <p className="text-zinc-300 text-[10px] mt-1">{generatedDiet.meals.snacks}</p>
                          </div>
                        </div>

                        {/* Export Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => exportToMarkdown(`Diet Plan - ${generatedDiet.goal}`, `Goal: ${generatedDiet.goal} | Weight: ${dietWeight}kg`, `**Breakfast:** ${generatedDiet.meals.breakfast}\n\n**Lunch:** ${generatedDiet.meals.lunch}\n\n**Dinner:** ${generatedDiet.meals.dinner}\n\n**Snacks:** ${generatedDiet.meals.snacks}`)}
                            className="flex-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-[10px] font-bold py-2 rounded-lg border border-zinc-800 cursor-pointer"
                          >
                            Export MD
                          </button>
                          <button
                            onClick={() => exportToPdf(`Diet Plan - ${generatedDiet.goal}`, `Goal: ${generatedDiet.goal} | Weight: ${dietWeight}kg`, `Breakfast: ${generatedDiet.meals.breakfast}\n\nLunch: ${generatedDiet.meals.lunch}\n\nDinner: ${generatedDiet.meals.dinner}\n\nSnacks: ${generatedDiet.meals.snacks}`)}
                            className="flex-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 text-[10px] font-bold py-2 rounded-lg border border-zinc-800 cursor-pointer"
                          >
                            Export PDF
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SCREEN: Wallet & Refunds */}
              {simScreen === 'wallet' && (
                <div className="flex-1 bg-zinc-950 flex flex-col justify-between overflow-hidden">
                  <div className="p-4 bg-zinc-900 border-b border-zinc-950 flex items-center gap-3">
                    <button onClick={() => setSimScreen('home')} className="text-zinc-400 hover:text-white cursor-pointer">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-xs font-bold text-white">Refund Wallet</h3>
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    
                    {/* Visual wallet balance card */}
                    <div className="bg-gradient-to-br from-amber-600 to-amber-800 rounded-2xl p-4 text-white shadow-lg shadow-amber-900/10">
                      <span className="text-[8px] font-mono tracking-widest uppercase text-amber-200">OPD REFUND LEDGER BALANCE</span>
                      <h2 className="text-2xl font-black mt-1 font-mono">₹{virtualWalletBalance.toFixed(2)}</h2>
                      
                      <div className="mt-4 flex justify-between items-center text-[9px] text-amber-100 border-t border-amber-500/30 pt-3">
                        <span>Status: Fully Active</span>
                        <span>Auto-withdraw linked bank</span>
                      </div>
                    </div>

                    {/* Claims history list summary */}
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase font-mono">Refund Transactions</h5>
                      <div className="space-y-1.5">
                        {claims.filter(c => c.status === 'Approved').map(c => (
                          <div key={c.id} className="bg-zinc-900 border border-zinc-850 rounded-xl p-2.5 flex justify-between items-center">
                            <div>
                              <h6 className="text-[10px] font-bold text-white">{c.hospitalName}</h6>
                              <p className="text-[8px] text-zinc-500">{c.date} • Claims payout</p>
                            </div>
                            <span className="text-[10px] text-emerald-400 font-mono font-bold">+₹{c.claimAmount}</span>
                          </div>
                        ))}
                        {claims.filter(c => c.status === 'Approved').length === 0 && (
                          <p className="text-[9px] text-zinc-600 text-center py-4">No refund payouts approved yet.</p>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* SCREEN: History */}
              {simScreen === 'history' && (
                <div className="flex-1 bg-zinc-950 flex flex-col justify-between overflow-hidden relative">
                  <div className="p-4 bg-zinc-900 border-b border-zinc-950 flex items-center gap-3">
                    <button onClick={() => setSimScreen('home')} className="text-zinc-400 hover:text-white cursor-pointer">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-xs font-bold text-white">OPD &amp; Bill History</h3>
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    
                    {/* Claims list */}
                    <div className="space-y-2">
                      <h5 className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider font-mono">Reimbursements Filed</h5>
                      <div className="space-y-2">
                        {claims.map((c) => {
                          const colors = {
                            Approved: {
                              bg: 'rgba(6, 78, 59, 0.6)',
                              text: '#34d399',
                              border: 'rgba(16, 185, 129, 0.4)'
                            },
                            Pending: {
                              bg: 'rgba(120, 53, 4, 0.6)',
                              text: '#fbbf24',
                              border: 'rgba(217, 119, 6, 0.4)'
                            },
                            Rejected: {
                              bg: 'rgba(153, 27, 27, 0.6)',
                              text: '#f87171',
                              border: 'rgba(239, 68, 68, 0.4)'
                            }
                          }[c.status] || {
                            bg: 'rgba(120, 53, 4, 0.6)',
                            text: '#fbbf24',
                            border: 'rgba(217, 119, 6, 0.4)'
                          };

                          return (
                            <div 
                              key={c.id} 
                              onClick={() => {
                                setPreviewClaim(c);
                                setHistoryPreviewZoom(1);
                                setHistoryPreviewTranslate({ x: 0, y: 0 });
                              }}
                              className="bg-zinc-900 border border-zinc-850 p-2.5 rounded-xl space-y-1 hover:bg-zinc-850 hover:border-zinc-700 transition duration-200 cursor-pointer group"
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] font-bold text-white font-mono">{c.id}</span>
                                <motion.span
                                  animate={{
                                    backgroundColor: colors.bg,
                                    color: colors.text,
                                    borderColor: colors.border,
                                    scale: c.status !== 'Pending' ? [1, 1.15, 1] : 1
                                  }}
                                  transition={{
                                    backgroundColor: { duration: 0.8, ease: 'easeInOut' },
                                    color: { duration: 0.8, ease: 'easeInOut' },
                                    borderColor: { duration: 0.8, ease: 'easeInOut' },
                                    scale: { duration: 0.4, ease: 'easeOut' }
                                  }}
                                  className="text-[8px] font-bold px-1.5 py-0.2 rounded-full border"
                                >
                                  {c.status}
                                </motion.span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] pt-1">
                                <div>
                                  <h6 className="font-bold text-zinc-300 group-hover:text-indigo-400 transition">{c.hospitalName}</h6>
                                  <p className="text-[8px] text-zinc-500">{c.doctorName}</p>
                                </div>
                                <span className="font-mono font-bold text-white">₹{c.billAmount}</span>
                              </div>
                              <div className="flex justify-between items-center pt-1.5 border-t border-zinc-850/50 text-[8px] text-zinc-500 font-mono">
                                <span>{c.date}</span>
                                <span className="text-indigo-400 group-hover:text-indigo-300 flex items-center gap-1 font-sans font-semibold">
                                  <FileText className="w-2.5 h-2.5 shrink-0" />
                                  View Receipt
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Payments list */}
                    <div className="space-y-2 pt-2 border-t border-zinc-900">
                      <h5 className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider font-mono">Payments Transaction Ledger</h5>
                      <div className="space-y-1.5">
                        {payments.map((p) => (
                          <div key={p.id} className="bg-zinc-900/40 border border-zinc-850 p-2 rounded-xl flex justify-between items-center text-[10px]">
                            <div>
                              <span className="font-bold text-zinc-300">{p.planName}</span>
                              <p className="text-[8px] text-zinc-500 font-mono mt-0.5">{p.date} • {p.paymentId}</p>
                            </div>
                            <span className="font-mono font-bold text-indigo-400">₹{p.amount}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* FULL-SCREEN RECEIPT PREVIEW OVERLAY */}
                  {previewClaim && (
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 50 }}
                      className="absolute inset-0 z-40 bg-zinc-950 flex flex-col justify-between overflow-hidden"
                    >
                      {/* Header */}
                      <div className="p-4 bg-zinc-900 border-b border-zinc-950 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-400" />
                          <div>
                            <h4 className="text-xs font-bold text-white">Invoice &amp; Receipt</h4>
                            <p className="text-[8px] text-zinc-500 font-mono">{previewClaim.id}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setPreviewClaim(null)}
                          className="text-zinc-400 hover:text-white cursor-pointer p-1 rounded-full hover:bg-zinc-850"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-between space-y-4">
                        
                        {/* Interactive Drag & Zoom Viewport Container */}
                        <div 
                          className="relative w-full h-[320px] overflow-hidden bg-zinc-950 rounded-2xl border border-zinc-850 flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
                          onMouseDown={handleMouseDownHistory}
                          onMouseMove={handleMouseMoveHistory}
                          onMouseUp={handleMouseUpHistory}
                          onMouseLeave={handleMouseUpHistory}
                        >
                          <div
                            style={{
                              transform: `translate(${historyPreviewTranslate.x}px, ${historyPreviewTranslate.y}px) scale(${historyPreviewZoom})`,
                              transition: isDraggingHistory ? 'none' : 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)'
                            }}
                            className="origin-center"
                          >
                            {previewClaim.receiptPreview ? (
                              /* Real uploaded image / prescription preview */
                              <div className="space-y-2 text-center w-full">
                                <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40 p-2 inline-block">
                                  <img
                                    src={previewClaim.receiptPreview}
                                    alt={previewClaim.receiptName || "Uploaded OPD Receipt"}
                                    className="max-h-[260px] max-w-full object-contain rounded-lg shadow-lg pointer-events-none"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                <p className="text-[9px] text-zinc-500 font-mono truncate max-w-[240px] mx-auto">
                                  {previewClaim.receiptName}
                                </p>
                              </div>
                            ) : (
                              /* Seeding/fallback mockup clinical invoice */
                              <div className="w-full max-w-xs bg-white text-zinc-900 rounded-2xl p-4 shadow-xl border border-zinc-200 font-mono text-[9px] space-y-3 relative overflow-hidden text-left pointer-events-none">
                                {/* Watermark badge for status */}
                                <div className="absolute right-2 top-2 select-none pointer-events-none opacity-15 rotate-12">
                                  <span className={`text-[10px] font-black border-2 px-1.5 py-0.5 rounded ${
                                    previewClaim.status === 'Approved' ? 'border-emerald-600 text-emerald-600' :
                                    previewClaim.status === 'Pending' ? 'border-amber-600 text-amber-600' : 'border-red-600 text-red-600'
                                  }`}>
                                    {previewClaim.status.toUpperCase()}
                                  </span>
                                </div>

                                {/* Clinic Header */}
                                <div className="text-center pb-2 border-b border-dashed border-zinc-300">
                                  <h5 className="font-sans font-black text-xs tracking-tight text-zinc-900 uppercase">
                                    {previewClaim.hospitalName}
                                  </h5>
                                  <p className="text-[8px] text-zinc-500 mt-0.5">Empanelled Cashless OPD Provider</p>
                                  <p className="text-[7px] text-zinc-400">GSTIN: 27AACCC4107K1ZB</p>
                                </div>

                                {/* Metadata */}
                                <div className="space-y-1 text-zinc-600">
                                  <div className="flex justify-between">
                                    <span>PATIENT:</span>
                                    <span className="font-bold text-zinc-900">{userName || "Sumit Sharma"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>DOCTOR:</span>
                                    <span className="font-bold text-zinc-900 truncate max-w-[140px]">{previewClaim.doctorName}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>DATE &amp; TIME:</span>
                                    <span className="text-zinc-900">{previewClaim.date} 11:30 AM</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>RECEIPT ID:</span>
                                    <span className="text-zinc-900 font-bold">{previewClaim.id.replace('CLM-', 'RCP-')}</span>
                                  </div>
                                </div>

                                {/* Service Breakdowns */}
                                <div className="pt-2 border-t border-dashed border-zinc-300 space-y-1">
                                  <span className="text-[8px] text-zinc-400 font-bold block">PARTICULARS:</span>
                                  <div className="flex justify-between text-zinc-700">
                                    <span>01. GENERAL OPD CONSULTATION</span>
                                    <span className="text-zinc-950 font-bold">₹{Math.floor(previewClaim.billAmount * 0.4)}</span>
                                  </div>
                                  <div className="flex justify-between text-zinc-700">
                                    <span>02. CLINICAL PHARMACY CHARGES</span>
                                    <span className="text-zinc-950 font-bold">₹{Math.floor(previewClaim.billAmount * 0.35)}</span>
                                  </div>
                                  <div className="flex justify-between text-zinc-700">
                                    <span>03. DIAGNOSTICS &amp; LAB DISPATCH</span>
                                    <span className="text-zinc-950 font-bold">₹{Math.floor(previewClaim.billAmount * 0.25)}</span>
                                  </div>
                                </div>

                                {/* Total bill amount */}
                                <div className="pt-2 border-t border-zinc-900/20 flex justify-between items-center text-[10px] font-sans font-black">
                                  <span className="text-zinc-600">TOTAL AMOUNT</span>
                                  <span className="text-zinc-950 text-xs">₹{previewClaim.billAmount.toFixed(2)}</span>
                                </div>

                                {/* Footnote */}
                                <div className="text-center text-[7px] text-zinc-400 pt-1.5 border-t border-dashed border-zinc-300">
                                  Thank you for visiting. This receipt serves as validation for cashless OPD claims.
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Zoom scale controls */}
                        <div className="w-full bg-zinc-900/40 p-2.5 border border-zinc-850 rounded-xl space-y-1.5 text-left">
                          <div className="flex justify-between items-center text-[9px] text-zinc-400 font-mono">
                            <span className="font-bold uppercase tracking-wide">Preview Zoom scale</span>
                            <span className="text-indigo-400 font-bold">{Math.round(historyPreviewZoom * 100)}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setHistoryPreviewZoom(prev => Math.max(1, prev - 0.25))}
                              className="bg-zinc-850 hover:bg-zinc-750 text-zinc-300 rounded text-xs font-bold w-5 h-5 flex items-center justify-center font-mono cursor-pointer"
                            >
                              -
                            </button>
                            <input
                              type="range"
                              min="1"
                              max="3.5"
                              step="0.05"
                              value={historyPreviewZoom}
                              onChange={(e) => setHistoryPreviewZoom(parseFloat(e.target.value))}
                              className="flex-1 accent-indigo-400 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
                            />
                            <button
                              type="button"
                              onClick={() => setHistoryPreviewZoom(prev => Math.min(3.5, prev + 0.25))}
                              className="bg-zinc-850 hover:bg-zinc-750 text-zinc-300 rounded text-xs font-bold w-5 h-5 flex items-center justify-center font-mono cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                          {historyPreviewZoom > 1 ? (
                            <p className="text-[7.5px] text-zinc-500 text-center font-mono animate-pulse">
                              Drag on the viewport to pan around the invoice
                            </p>
                          ) : (
                            <p className="text-[7.5px] text-zinc-600 text-center font-mono">
                              Increase zoom to enable interactive detail panning
                            </p>
                          )}
                        </div>

                        {/* Summary Metadata Details Card in Dark Style */}
                        <div className="w-full bg-zinc-900/60 border border-zinc-850 rounded-xl p-3 space-y-2 text-[10px]">
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Claim ID:</span>
                            <span className="font-mono text-zinc-300 font-bold">{previewClaim.id}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Facility:</span>
                            <span className="font-bold text-white">{previewClaim.hospitalName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Bill Amount:</span>
                            <span className="font-mono font-bold text-white">₹{previewClaim.billAmount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Status:</span>
                            <span className={`font-bold ${
                              previewClaim.status === 'Approved' ? 'text-emerald-400' :
                              previewClaim.status === 'Pending' ? 'text-amber-400' : 'text-red-400'
                            }`}>{previewClaim.status}</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="p-4 bg-zinc-900 border-t border-zinc-950 flex gap-2">
                        <button
                          onClick={() => {
                            alert("Receipt PDF file generated & downloaded locally!");
                          }}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 rounded-lg cursor-pointer transition flex items-center justify-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>Download PDF Receipt</span>
                        </button>
                        <button
                          onClick={() => setPreviewClaim(null)}
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition"
                        >
                          Close
                        </button>
                      </div>
                    </motion.div>
                  )}

                </div>
              )}

              {/* SCREEN: Admin Portal (Claims Approver) */}
              {simScreen === 'admin' && (
                <div className="flex-1 bg-zinc-950 flex flex-col justify-between overflow-hidden">
                  <div className="p-4 bg-zinc-900 border-b border-zinc-950 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSimScreen('home')} className="text-zinc-400 hover:text-white cursor-pointer">
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <h3 className="text-xs font-bold text-white text-amber-400">Admin Dashboard</h3>
                    </div>
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    
                    {/* Claims Approval Queue */}
                    <div className="space-y-2">
                      <h5 className="text-[9px] font-bold uppercase text-zinc-500 font-mono tracking-wider">
                        Pending Claims Queue ({claims.filter(c => c.status === 'Pending').length})
                      </h5>
                      <div className="space-y-2">
                        {claims.filter(c => c.status === 'Pending').map((c) => (
                          <div key={c.id} className="bg-zinc-900 border border-amber-900/40 p-2.5 rounded-xl space-y-2">
                            <div className="flex justify-between items-center text-[9px] font-mono">
                              <span className="font-bold text-white">{c.id}</span>
                              <span className="text-amber-400 font-bold">₹{c.billAmount}</span>
                            </div>
                            <div className="text-[10px]">
                              <p className="font-bold text-zinc-300">{c.hospitalName}</p>
                              <p className="text-zinc-500 font-mono text-[9px] mt-0.5">Attached: {c.receiptName}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveClaim(c.id, c.billAmount, mobileNumber)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px] py-1 rounded-lg cursor-pointer text-center"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectClaim(c.id, mobileNumber)}
                                className="flex-1 bg-red-950 hover:bg-red-900 text-red-400 font-bold text-[9px] py-1 rounded-lg cursor-pointer text-center"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ))}
                        {claims.filter(c => c.status === 'Pending').length === 0 && (
                          <p className="text-[10px] text-zinc-600 text-center py-4">No pending claims in queue.</p>
                        )}
                      </div>
                    </div>

                    {/* Empanelled Hospital Creator Form */}
                    <div className="bg-zinc-900 p-3 rounded-xl space-y-2 border border-zinc-850">
                      <h5 className="text-[9px] font-bold uppercase text-zinc-400 font-mono">Empanel New Hospital</h5>
                      <form onSubmit={handleAddHospital} className="space-y-2">
                        <input
                          type="text"
                          placeholder="Hospital Commercial Name"
                          value={newHospitalName}
                          onChange={(e) => setNewHospitalName(e.target.value)}
                          className="w-full bg-zinc-950 text-[10px] p-2 border border-zinc-850 rounded-lg text-white outline-none focus:border-indigo-500"
                        />
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            type="text"
                            placeholder="City"
                            value={newHospitalCity}
                            onChange={(e) => setNewHospitalCity(e.target.value)}
                            className="w-full bg-zinc-950 text-[10px] p-2 border border-zinc-850 rounded-lg text-white outline-none focus:border-indigo-500"
                          />
                          <input
                            type="text"
                            placeholder="Hotline contact"
                            value={newHospitalContact}
                            onChange={(e) => setNewHospitalContact(e.target.value)}
                            className="w-full bg-zinc-950 text-[10px] p-2 border border-zinc-850 rounded-lg text-white outline-none focus:border-indigo-500"
                          />
                        </div>
                        <button
                          type="submit"
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-bold py-1.5 rounded-lg transition"
                        >
                          Add Hospital to Network
                        </button>
                      </form>
                    </div>

                  </div>
                </div>
              )}

              {/* SCREEN: Profile / Simulation variables */}
              {simScreen === 'profile' && (
                <div className="flex-1 bg-zinc-950 flex flex-col justify-between overflow-hidden">
                  <div className="p-4 bg-zinc-900 border-b border-zinc-950 flex items-center gap-3">
                    <button onClick={() => setSimScreen('home')} className="text-zinc-400 hover:text-white cursor-pointer">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <h3 className="text-xs font-bold text-white">My Health Profile</h3>
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    
                    {/* Core user credentials layout */}
                    <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-850 text-xs space-y-2">
                      <div className="flex justify-between border-b border-zinc-850 pb-1.5">
                        <span className="text-zinc-500">Legal Name</span>
                        <span className="text-white font-semibold">{userName}</span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-850 pb-1.5">
                        <span className="text-zinc-500">Mobile Verification</span>
                        <span className="text-emerald-400 font-mono font-semibold">+91 {mobileNumber}</span>
                      </div>
                      <div className="flex justify-between border-b border-zinc-850 pb-1.5">
                        <span className="text-zinc-500">Subscription Tier</span>
                        <span className="text-indigo-400 font-bold">{userPlan}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Remaining Claims</span>
                        <span className="text-white font-bold">{userPlan === 'Gold Max Pro' ? 'Unlimited' : `${opdRemaining}/${opdLimit}`}</span>
                      </div>
                    </div>

                    {/* Developer parameters tuning inside simulator */}
                    <div className="bg-zinc-900 p-3 rounded-xl border border-zinc-850 space-y-2.5">
                      <h5 className="text-[9px] font-bold uppercase text-indigo-400 font-mono">Tweak Simulation Variables</h5>
                      
                      <div className="space-y-1 text-[10px]">
                        <span className="text-zinc-500">Simulated User Name</span>
                        <input
                          type="text"
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-1.5 text-white"
                        />
                      </div>

                      <div className="space-y-1 text-[10px]">
                        <span className="text-zinc-500">Remaining Claims Counter</span>
                        <input
                          type="number"
                          value={opdRemaining}
                          onChange={(e) => setOpdRemaining(parseInt(e.target.value) || 0)}
                          className="w-full bg-zinc-950 border border-zinc-850 rounded-lg p-1.5 text-white font-mono"
                        />
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* RAZORPAY PAYMENT SIMULATION OVERLAY MODAL */}
              {razorpayOpen && razorpayPlan && (
                <div className="absolute inset-0 bg-black/80 z-50 flex items-end justify-center">
                  <div className="w-full bg-zinc-900 rounded-t-3xl border-t border-zinc-800 p-4 space-y-4">
                    
                    {/* Header with secure branding */}
                    <div className="flex justify-between items-center pb-2 border-b border-zinc-850">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 bg-indigo-600 rounded flex items-center justify-center text-white text-[10px] font-black">
                          R
                        </div>
                        <div>
                          <h4 className="text-[11px] font-black text-white">Razorpay Secure</h4>
                          <p className="text-[8px] text-zinc-500">MID: mer_geminicare_90219</p>
                        </div>
                      </div>
                      <button onClick={() => setRazorpayOpen(false)} className="text-zinc-500 hover:text-white cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {razorpayStep === 'details' && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-400">Paying for {razorpayPlan.name}</span>
                          <span className="font-extrabold text-white">₹{razorpayPlan.price}.00</span>
                        </div>

                        {/* Dummy Card Inputs */}
                        <div className="space-y-2">
                          <label className="text-[8px] font-bold uppercase text-zinc-500 font-mono tracking-wider">
                            Card Number (Simulation)
                          </label>
                          <input
                            type="text"
                            value={rzpCardNumber}
                            onChange={(e) => setRzpCardNumber(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-lg text-xs p-2 text-white font-mono"
                          />

                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold uppercase text-zinc-500 font-mono">Expiry</label>
                              <input
                                type="text"
                                value={rzpExpiry}
                                onChange={(e) => setRzpExpiry(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-850 rounded-lg text-xs p-2 text-white font-mono"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] font-bold uppercase text-zinc-500 font-mono">CVV</label>
                              <input
                                type="password"
                                value={rzpCvv}
                                onChange={(e) => setRzpCvv(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-850 rounded-lg text-xs p-2 text-white font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={executeRazorpayPayment}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs py-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>Pay ₹{razorpayPlan.price} via Razorpay</span>
                        </button>
                      </div>
                    )}

                    {razorpayStep === 'processing' && (
                      <div className="py-8 text-center space-y-3">
                        <div className="w-8 h-8 border-2 border-indigo-400/20 border-t-indigo-400 rounded-full animate-spin mx-auto" />
                        <h4 className="text-xs font-bold text-white">Communicating with Razorpay servers...</h4>
                        <p className="text-[9px] text-zinc-500 font-mono">Securing gateway handshake (test mode)</p>
                      </div>
                    )}

                    {razorpayStep === 'success' && (
                      <div className="py-8 text-center space-y-3">
                        <div className="w-10 h-10 bg-emerald-950/60 border border-emerald-900/40 rounded-full flex items-center justify-center text-emerald-400 mx-auto">
                          <CheckCircle className="w-6 h-6" />
                        </div>
                        <h4 className="text-xs font-bold text-white">Payment Authorized Successfully!</h4>
                        <p className="text-[9px] text-zinc-500 font-mono">Receipt code: pay_capture_succeeded</p>
                      </div>
                    )}

                  </div>
                </div>
              )}

            </div>

            {/* Bottom Physical Home Navigation Indicator */}
            <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 w-28 h-1 bg-zinc-700 rounded-full z-50" />

          </div>
        </div>

        {/* Right Area: Dynamic Developer Engineering Desk */}
        <div className="lg:col-span-7 bg-zinc-900/40 border border-zinc-900 rounded-2xl flex flex-col overflow-hidden">
          
          {/* TAB 1: SQL Database Architect */}
          {activeWorkspaceTab === 'database' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-zinc-900 bg-zinc-900/60 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white">Relational PostgreSQL Database Architecture</h3>
                  <p className="text-[11px] text-zinc-400">Complete normalized SQL tables designed for Gemini Care OPD core platform</p>
                </div>
              </div>

              {/* Grid content columns */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
                
                {/* Left side: Table schema selectors */}
                <div className="md:col-span-4 border-r border-zinc-900 overflow-y-auto bg-zinc-950/20">
                  {sqlTables.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setActiveDbTable(t.name)}
                      className={`w-full text-left p-3 border-b border-zinc-900 transition flex items-center justify-between cursor-pointer ${
                        activeDbTable === t.name ? 'bg-indigo-950/30 text-indigo-400 border-l-2 border-l-indigo-500' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-bold text-xs truncate">{t.name}</div>
                        <p className="text-[9px] text-zinc-500 truncate mt-0.5">{t.description}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  ))}
                </div>

                {/* Right side: Detailed schema view & code block */}
                <div className="md:col-span-8 overflow-y-auto p-5 space-y-5">
                  {sqlTables.map((t) => t.name === activeDbTable && (
                    <div key={t.name} className="space-y-4">
                      
                      {/* Title and stats summary */}
                      <div>
                        <h4 className="text-base font-black text-white">Table: {t.name}</h4>
                        <p className="text-xs text-zinc-400 mt-1">{t.description}</p>
                      </div>

                      {/* Columns mapping panel */}
                      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/40">
                        <div className="bg-zinc-900/60 px-3 py-2 border-b border-zinc-800 text-[9px] font-bold text-zinc-400 tracking-wider font-mono grid grid-cols-12 gap-2">
                          <span className="col-span-4">COLUMN</span>
                          <span className="col-span-3">TYPE</span>
                          <span className="col-span-5">CONSTRAINTS &amp; INFO</span>
                        </div>
                        <div className="divide-y divide-zinc-900">
                          {t.columns.map((col) => (
                            <div key={col.name} className="p-3 text-[11px] grid grid-cols-12 gap-2 font-mono items-center">
                              <span className="col-span-4 font-bold text-indigo-400">{col.name}</span>
                              <span className="col-span-3 text-zinc-300">{col.type}</span>
                              <span className="col-span-5 text-zinc-500 text-[10px]">{col.constraints || 'None'}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Code action copyable block */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-zinc-500 font-bold">SQL CREATE QUERY</span>
                          <button
                            onClick={() => copyToClipboard(t.sql, t.name)}
                            className="flex items-center gap-1 text-[10px] text-indigo-400 hover:underline font-bold"
                          >
                            {copiedId === t.name ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy SQL Script</span>
                              </>
                            )}
                          </button>
                        </div>
                        <pre className="bg-zinc-950 text-[11px] font-mono text-zinc-300 p-4 rounded-xl border border-zinc-850 overflow-x-auto whitespace-pre leading-relaxed">
                          {t.sql}
                        </pre>
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: Flutter Project Architecture Tree */}
          {activeWorkspaceTab === 'flutter' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-zinc-900 bg-zinc-900/60">
                <h3 className="font-bold text-sm text-white">Flutter Clean Architecture File Desk</h3>
                <p className="text-[11px] text-zinc-400">Production-grade Flutter/Dart code integrating Riverpod state management, GoRouter, and Razorpay</p>
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
                
                {/* Clean architecture directory map */}
                <div className="md:col-span-4 border-r border-zinc-900 overflow-y-auto bg-zinc-950/20 p-3 space-y-4">
                  
                  <div>
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono block mb-2">PROJECT TREE</span>
                    
                    <div className="space-y-1">
                      
                      {/* Project outline items */}
                      {flutterFiles.map((f) => (
                        <button
                          key={f.path}
                          onClick={() => setSelectedFlutterFile(f.path)}
                          className={`w-full text-left p-2 rounded-lg text-xs font-mono transition flex items-center justify-between cursor-pointer ${
                            selectedFlutterFile === f.path ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <FileCode className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{f.path}</span>
                          </div>
                          <ChevronRight className="w-3 h-3 shrink-0" />
                        </button>
                      ))}

                    </div>
                  </div>

                  {/* Architecture guidelines card */}
                  <div className="bg-indigo-950/10 border border-indigo-900/30 p-3 rounded-xl text-[10px] text-zinc-400 space-y-1.5">
                    <span className="font-bold text-indigo-400 uppercase font-mono text-[9px] tracking-wider block">Clean Arch Rules</span>
                    <p>• <strong>Core:</strong> Global routes, security themes, network providers.</p>
                    <p>• <strong>Features:</strong> Self-contained domain states, presentation controls, and data gateways.</p>
                    <p>• <strong>Riverpod:</strong> Complete decouple of UI logic from Flutter framework scopes.</p>
                  </div>

                </div>

                {/* Complete code display box */}
                <div className="md:col-span-8 overflow-y-auto p-5 flex flex-col justify-between">
                  {flutterFiles.map((f) => f.path === selectedFlutterFile && (
                    <div key={f.path} className="space-y-4 flex-1 flex flex-col justify-between">
                      
                      <div>
                        <div className="flex justify-between items-center pb-2">
                          <div>
                            <h4 className="text-xs font-bold text-white font-mono">{f.path}</h4>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{f.description}</p>
                          </div>
                          <button
                            onClick={() => copyToClipboard(f.code, f.path)}
                            className="flex items-center gap-1 text-[10px] text-indigo-400 hover:underline font-bold"
                          >
                            {copiedId === f.path ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy File</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Interactive IDE styled box */}
                        <div className="relative border border-zinc-850 rounded-xl overflow-hidden">
                          <div className="bg-zinc-950/80 px-4 py-1.5 border-b border-zinc-850 flex items-center justify-between text-[9px] text-zinc-500 font-mono">
                            <span>DART PROGRAM</span>
                            <span>SDK 3.2+</span>
                          </div>
                          <pre className="bg-zinc-950 text-[10px] font-mono text-zinc-300 p-4 overflow-x-auto whitespace-pre leading-relaxed max-h-[460px]">
                            {f.code}
                          </pre>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: App Simulator Live Telemetry Logging */}
          {activeWorkspaceTab === 'simulator' && (
            <div className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="p-4 border-b border-zinc-900 bg-zinc-900/60">
                <h3 className="font-bold text-sm text-white">System Telemetry &amp; Sandbox Logs</h3>
                <p className="text-[11px] text-zinc-400">Real-time telemetry measuring active simulation actions and secure server integrations</p>
              </div>

              <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
                
                {/* Active Subscription status panel */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-850">
                    <span className="text-[9px] font-mono text-zinc-500">USER SUBSCRIPTION</span>
                    <h4 className="text-sm font-bold text-white mt-1">{userPlan}</h4>
                    <p className="text-[9px] text-emerald-400 font-mono mt-0.5">{opdRemaining} claims remaining</p>
                  </div>
                  <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-850">
                    <span className="text-[9px] font-mono text-zinc-500 font-bold">WALLET BALANCE</span>
                    <h4 className="text-sm font-mono font-bold text-indigo-400 mt-1">₹{virtualWalletBalance.toFixed(2)}</h4>
                    <p className="text-[9px] text-zinc-500 mt-0.5">Approved OPD refunds</p>
                  </div>
                  <div className="bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-850">
                    <span className="text-[9px] font-mono text-zinc-500">API HEALTH</span>
                    <h4 className={`text-sm font-bold mt-1 ${apiStatus.healthy ? 'text-emerald-400' : 'text-amber-500'}`}>
                      {apiStatus.healthy ? 'CONNECTED' : 'LOCAL SIMULATED'}
                    </h4>
                    <p className="text-[9px] text-zinc-500 truncate mt-0.5">{apiStatus.message}</p>
                  </div>
                </div>

                {/* Pre-flight micro-pricing analysis block */}
                <div className="bg-zinc-900/40 p-4 border border-zinc-850 rounded-xl space-y-3">
                  <span className="font-bold text-[10px] uppercase font-mono tracking-wider text-zinc-400 block">
                    Pre-Flight Cost Estimator (Heuristic Analytics)
                  </span>

                  <div className="grid grid-cols-2 gap-4 text-[11px] font-mono border-b border-zinc-850/60 pb-3">
                    <div className="space-y-1">
                      <span className="text-zinc-500">Active Mobile Session Length</span>
                      <p className="text-zinc-200 font-bold">{userName.length + mobileNumber.length + userPlan.length} characters</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-zinc-500">Estimated Core State Tokens</span>
                      <p className="text-indigo-400 font-bold">
                        {estimateTokens(userName + mobileNumber + userPlan)} tokens
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-zinc-500">Theoretical Cost (Gemini 3.5-Flash pricing model)</span>
                    <span className="font-bold text-indigo-400">
                      {formatUsd(calculateCost(estimateTokens(userName + mobileNumber + userPlan)))} USD
                    </span>
                  </div>
                </div>

                {/* Active sandbox activity logs console */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500">
                    <span>EMULATOR SESSION ACTIVITY</span>
                    <span>AUTOMATIC LOGS</span>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-3 h-48 font-mono text-[10px] text-zinc-400 overflow-y-auto space-y-1">
                    <p className="text-zinc-600">[{new Date().toLocaleTimeString()}] Handshaking with secure local Sandbox Environment...</p>
                    <p className="text-zinc-600">[{new Date().toLocaleTimeString()}] Registered empanelled facilities: Apollo, Fortis, Max, Kokilaben.</p>
                    <p className="text-indigo-400">[{new Date().toLocaleTimeString()}] API gateway status check passed: {apiStatus.healthy ? 'OK' : 'MOCK_FALLBACK'}.</p>
                    {isLoggedIn && (
                      <p className="text-emerald-400">[{new Date().toLocaleTimeString()}] Firebase Authentication: User verified phone (+91 {mobileNumber}).</p>
                    )}
                    {userPlan !== 'None' && (
                      <p className="text-amber-400">[{new Date().toLocaleTimeString()}] Razorpay Transaction captured: Active Premium subscription set to {userPlan}.</p>
                    )}
                    {claims.map((c) => (
                      <p key={c.id} className="text-zinc-500">
                        [{c.date}] OPD Claim {c.id} for ₹{c.billAmount} registered status as "{c.status}".
                      </p>
                    ))}
                    {dietPlans.map((d) => (
                      <p key={d.id} className="text-green-400">
                        [{d.date}] AI Diet Plan {d.id} compiled target of {d.calories} Kcal daily.
                      </p>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 4: Admin Controls & Operations Dashboard */}
          {activeWorkspaceTab === 'admin' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-zinc-900 bg-zinc-900/60 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white">Platform Administration Desk</h3>
                  <p className="text-[11px] text-zinc-400">Durable cloud analytics and direct claims queue verification panel</p>
                </div>
                <button
                  onClick={refreshAdminData}
                  className="flex items-center gap-1 text-[10px] bg-zinc-800 hover:bg-zinc-750 text-indigo-400 font-bold px-2.5 py-1 rounded-lg border border-zinc-700 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Refresh Cloud Data</span>
                </button>
              </div>

              <div className="flex-1 p-5 overflow-y-auto space-y-5">
                
                {/* KPI Metrics Dashboard Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-850">
                    <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Registered Profiles</span>
                    <h4 className="text-base font-extrabold text-white mt-1">{Math.max(allUsersDb.length, 1)} Users</h4>
                    <p className="text-[9px] text-indigo-400 font-mono mt-0.5">Durable in Firestore</p>
                  </div>
                  <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-850">
                    <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Total Income raised</span>
                    <h4 className="text-base font-mono font-black text-emerald-400 mt-1">
                      ₹{allPaymentsDb.reduce((acc, curr) => acc + curr.amount, 0)}
                    </h4>
                    <p className="text-[9px] text-zinc-500 mt-0.5">{allPaymentsDb.length} Payments processed</p>
                  </div>
                  <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-850">
                    <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Approved Cashback</span>
                    <h4 className="text-base font-mono font-black text-indigo-400 mt-1">
                      ₹{allClaimsDb.filter(c => c.status === 'Approved').reduce((acc, curr) => acc + curr.billAmount, 0)}
                    </h4>
                    <p className="text-[9px] text-zinc-500 mt-0.5">Disbursed to wallets</p>
                  </div>
                  <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-850">
                    <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest block">Outstanding Claims</span>
                    <h4 className="text-base font-extrabold text-amber-400 mt-1">
                      {allClaimsDb.filter(c => c.status === 'Pending').length} Pending
                    </h4>
                    <p className="text-[9px] text-zinc-500 mt-0.5">Awaiting verification</p>
                  </div>
                </div>

                {/* Analytical Charts Block */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Revenue BarChart */}
                  <div className="bg-zinc-950/40 border border-zinc-850 rounded-xl p-4 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-zinc-400">
                      Cash Revenue Raised per Premium Tier
                    </span>
                    <div className="h-44 w-full text-xs font-mono">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { name: 'Bronze (₹29)', revenue: allPaymentsDb.filter(p => p.planName.toLowerCase().includes('bronze')).reduce((acc, curr) => acc + curr.amount, 0) || 29 },
                            { name: 'Silver (₹99)', revenue: allPaymentsDb.filter(p => p.planName.toLowerCase().includes('silver')).reduce((acc, curr) => acc + curr.amount, 0) || 198 },
                            { name: 'Gold (₹999)', revenue: allPaymentsDb.filter(p => p.planName.toLowerCase().includes('gold')).reduce((acc, curr) => acc + curr.amount, 0) || 999 }
                          ]}
                          margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="name" stroke="#71717a" fontSize={10} />
                          <YAxis stroke="#71717a" fontSize={10} />
                          <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a' }} />
                          <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Subscriptions PieChart */}
                  <div className="bg-zinc-950/40 border border-zinc-850 rounded-xl p-4 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-zinc-400">
                      User Subscription Tier Distribution
                    </span>
                    <div className="h-44 w-full flex items-center justify-center text-xs font-mono">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Bronze Plan', value: Math.max(allUsersDb.filter(u => u.activePlan === 'Bronze Starter').length, 2) },
                              { name: 'Silver Plan', value: Math.max(allUsersDb.filter(u => u.activePlan === 'Silver Regular').length, 4) },
                              { name: 'Gold VIP', value: Math.max(allUsersDb.filter(u => u.activePlan === 'Gold Max Pro').length, 1) },
                              { name: 'None', value: Math.max(allUsersDb.filter(u => u.activePlan === 'None' || !u.activePlan).length, 3) }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#f59e0b" />
                            <Cell fill="#6366f1" />
                            <Cell fill="#fbbf24" />
                            <Cell fill="#4b5563" />
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a' }} />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                         {/* Claims approver queue */}
                  <div className="border border-zinc-850 rounded-xl overflow-hidden bg-zinc-950/40">
                    <div className="bg-zinc-900/60 px-4 py-2 border-b border-zinc-850 flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                        OPD Claims Approvals Ledger
                      </span>
                      <span className="text-[9px] bg-amber-950 text-amber-400 font-bold px-2 py-0.5 rounded font-mono">
                        {filteredSortedClaims.filter(c => c.status === 'Pending').length} Action Pending
                      </span>
                    </div>

                    {/* Real-time search and sort controls */}
                    <div className="bg-zinc-900/30 p-3 border-b border-zinc-850 flex flex-col md:flex-row gap-3 items-center justify-between">
                      <div className="relative w-full md:max-w-xs">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-zinc-500">
                          <Search className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="text"
                          placeholder="Search claims (ID, doctor, hospital, user, status)..."
                          value={searchClaim}
                          onChange={(e) => setSearchClaim(e.target.value)}
                          className="w-full pl-8 pr-7 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500 font-mono"
                        />
                        {searchClaim && (
                          <button
                            onClick={() => setSearchClaim('')}
                            className="absolute inset-y-0 right-0 flex items-center pr-2 text-zinc-500 hover:text-zinc-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center text-[10px] font-mono text-zinc-400">
                        <span className="text-zinc-500 text-[9px] uppercase font-bold">Quick Sort:</span>
                        {(['date', 'status', 'amount', 'user'] as const).map((field) => (
                          <button
                            key={field}
                            onClick={() => {
                              if (claimsSortField === field) {
                                setClaimsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                              } else {
                                setClaimsSortField(field);
                                setClaimsSortDirection('desc');
                              }
                            }}
                            className={`px-2 py-1 rounded border transition capitalize cursor-pointer ${
                              claimsSortField === field
                                ? 'bg-indigo-950 border-indigo-800 text-indigo-400 font-bold'
                                : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-350'
                            }`}
                          >
                            {field === 'user' ? 'User' : field} {claimsSortField === field ? (claimsSortDirection === 'asc' ? '▲' : '▼') : ''}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs divide-y divide-zinc-900">
                        <thead className="bg-zinc-950 text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                          <tr>
                            <th className="p-3">Claim ID</th>
                            <th 
                              className="p-3 cursor-pointer hover:text-zinc-300 transition select-none"
                              onClick={() => {
                                if (claimsSortField === 'user') {
                                  setClaimsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setClaimsSortField('user');
                                  setClaimsSortDirection('asc');
                                }
                              }}
                            >
                              User Mobile {claimsSortField === 'user' ? (claimsSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </th>
                            <th className="p-3">Facility / Doctor</th>
                            <th 
                              className="p-3 cursor-pointer hover:text-zinc-300 transition select-none"
                              onClick={() => {
                                if (claimsSortField === 'date') {
                                  setClaimsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setClaimsSortField('date');
                                  setClaimsSortDirection('desc');
                                }
                              }}
                            >
                              Date {claimsSortField === 'date' ? (claimsSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </th>
                            <th className="p-3">Receipt Info</th>
                            <th 
                              className="p-3 text-right cursor-pointer hover:text-zinc-300 transition select-none"
                              onClick={() => {
                                if (claimsSortField === 'amount') {
                                  setClaimsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setClaimsSortField('amount');
                                  setClaimsSortDirection('desc');
                                }
                              }}
                            >
                              Amount {claimsSortField === 'amount' ? (claimsSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </th>
                            <th 
                              className="p-3 text-center cursor-pointer hover:text-zinc-300 transition select-none"
                              onClick={() => {
                                if (claimsSortField === 'status') {
                                  setClaimsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setClaimsSortField('status');
                                  setClaimsSortDirection('asc');
                                }
                              }}
                            >
                              Status / Actions {claimsSortField === 'status' ? (claimsSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                          {filteredSortedClaims.map((c) => (
                            <tr key={c.id} className="hover:bg-zinc-900/20 text-[11px]">
                              <td className="p-3 font-mono font-bold text-zinc-300">{c.id}</td>
                              <td className="p-3 font-mono text-zinc-400">{c.mobileNumber || '+91 99999 12345'}</td>
                              <td className="p-3">
                                <div className="font-bold text-zinc-200">{c.hospitalName}</div>
                                <div className="text-[9px] text-zinc-500">{c.doctorName}</div>
                              </td>
                              <td className="p-3 font-mono text-zinc-400">{c.date || '2026-07-03'}</td>
                              <td className="p-3 truncate max-w-[120px]" title={c.receiptName}>
                                <span className="font-mono text-zinc-500 text-[10px]">{c.receiptName || 'no_receipt.png'}</span>
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-emerald-400 font-black">₹{c.billAmount}</td>
                              <td className="p-3">
                                {c.status === 'Pending' ? (
                                  <div className="flex gap-1 justify-center">
                                    <button
                                      onClick={() => handleApproveClaim(c.id, c.billAmount, c.mobileNumber || mobileNumber)}
                                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[9px] px-2 py-1 rounded cursor-pointer"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleRejectClaim(c.id, c.mobileNumber || mobileNumber)}
                                      className="bg-red-950 hover:bg-red-900 text-red-400 font-bold text-[9px] px-2 py-1 rounded cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-center">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                                      c.status === 'Approved' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'
                                    }`}>
                                      {c.status}
                                    </span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                          {filteredSortedClaims.length === 0 && (
                            <tr>
                              <td colSpan={7} className="p-4 text-center text-zinc-500 text-[10px]">
                                No claim submissions match search query or filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Registered Users Directory */}
                  <div className="border border-zinc-850 rounded-xl overflow-hidden bg-zinc-950/40">
                    <div className="bg-zinc-900/60 px-4 py-2 border-b border-zinc-850">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                        Durable Platform Users Directory
                      </span>
                    </div>

                    {/* Real-time search and sort controls */}
                    <div className="bg-zinc-900/30 p-3 border-b border-zinc-850 flex flex-col md:flex-row gap-3 items-center justify-between">
                      <div className="relative w-full md:max-w-xs">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-zinc-500">
                          <Search className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="text"
                          placeholder="Search users (Name, mobile, active plan)..."
                          value={searchUser}
                          onChange={(e) => setSearchUser(e.target.value)}
                          className="w-full pl-8 pr-7 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500 font-mono"
                        />
                        {searchUser && (
                          <button
                            onClick={() => setSearchUser('')}
                            className="absolute inset-y-0 right-0 flex items-center pr-2 text-zinc-500 hover:text-zinc-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center text-[10px] font-mono text-zinc-400">
                        <span className="text-zinc-500 text-[9px] uppercase font-bold">Quick Sort:</span>
                        {(['name', 'mobile', 'balance'] as const).map((field) => (
                          <button
                            key={field}
                            onClick={() => {
                              if (usersSortField === field) {
                                setUsersSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                              } else {
                                setUsersSortField(field);
                                setUsersSortDirection('asc');
                              }
                            }}
                            className={`px-2 py-1 rounded border transition capitalize cursor-pointer ${
                              usersSortField === field
                                ? 'bg-indigo-950 border-indigo-800 text-indigo-400 font-bold'
                                : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-350'
                            }`}
                          >
                            {field === 'balance' ? 'Balance' : field} {usersSortField === field ? (usersSortDirection === 'asc' ? '▲' : '▼') : ''}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs divide-y divide-zinc-900">
                        <thead className="bg-zinc-950 text-[9px] font-mono text-zinc-500 uppercase tracking-wider sticky top-0">
                          <tr>
                            <th 
                              className="p-3 cursor-pointer hover:text-zinc-300 transition select-none"
                              onClick={() => {
                                if (usersSortField === 'mobile') {
                                  setUsersSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setUsersSortField('mobile');
                                  setUsersSortDirection('asc');
                                }
                              }}
                            >
                              Verified Mobile {usersSortField === 'mobile' ? (usersSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </th>
                            <th 
                              className="p-3 cursor-pointer hover:text-zinc-300 transition select-none"
                              onClick={() => {
                                if (usersSortField === 'name') {
                                  setUsersSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setUsersSortField('name');
                                  setUsersSortDirection('asc');
                                }
                              }}
                            >
                              Full Legal Name {usersSortField === 'name' ? (usersSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </th>
                            <th className="p-3">Active Premium Tier</th>
                            <th 
                              className="p-3 text-right cursor-pointer hover:text-zinc-300 transition select-none"
                              onClick={() => {
                                if (usersSortField === 'balance') {
                                  setUsersSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setUsersSortField('balance');
                                  setUsersSortDirection('desc');
                                }
                              }}
                            >
                              Wallet Balance {usersSortField === 'balance' ? (usersSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                          {filteredSortedUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-zinc-900/20 text-[11px]">
                              <td className="p-3 font-mono font-semibold text-emerald-400">+91 {u.mobileNumber}</td>
                              <td className="p-3 text-zinc-200 font-bold">{u.name || 'Anonymous User'}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                  u.activePlan === 'Gold Max Pro' ? 'bg-amber-950 text-amber-400' :
                                  u.activePlan === 'Silver Regular' ? 'bg-indigo-950 text-indigo-400' : 'bg-zinc-900 text-zinc-400'
                                }`}>
                                  {u.activePlan || 'None'}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-white">₹{u.virtualWalletBalance?.toFixed(2) || '0.00'}</td>
                            </tr>
                          ))}
                          {filteredSortedUsers.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-4 text-center text-zinc-500 text-[10px]">
                                No directory users match your search queries.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Live Transaction Ledger */}
                  <div className="border border-zinc-850 rounded-xl overflow-hidden bg-zinc-950/40">
                    <div className="bg-zinc-900/60 px-4 py-2 border-b border-zinc-850">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                        Durable Payments Log (Razorpay Cash Gateways)
                      </span>
                    </div>

                    {/* Real-time search and sort controls */}
                    <div className="bg-zinc-900/30 p-3 border-b border-zinc-850 flex flex-col md:flex-row gap-3 items-center justify-between">
                      <div className="relative w-full md:max-w-xs">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-zinc-500">
                          <Search className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="text"
                          placeholder="Search payments (ID, mobile, plan)..."
                          value={searchPayment}
                          onChange={(e) => setSearchPayment(e.target.value)}
                          className="w-full pl-8 pr-7 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500 font-mono"
                        />
                        {searchPayment && (
                          <button
                            onClick={() => setSearchPayment('')}
                            className="absolute inset-y-0 right-0 flex items-center pr-2 text-zinc-500 hover:text-zinc-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center text-[10px] font-mono text-zinc-400">
                        <span className="text-zinc-500 text-[9px] uppercase font-bold">Quick Sort:</span>
                        {(['date', 'amount', 'user'] as const).map((field) => (
                          <button
                            key={field}
                            onClick={() => {
                              if (paymentsSortField === field) {
                                setPaymentsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                              } else {
                                setPaymentsSortField(field);
                                setPaymentsSortDirection('desc');
                              }
                            }}
                            className={`px-2 py-1 rounded border transition capitalize cursor-pointer ${
                              paymentsSortField === field
                                ? 'bg-indigo-950 border-indigo-800 text-indigo-400 font-bold'
                                : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:text-zinc-350'
                            }`}
                          >
                            {field === 'user' ? 'User' : field} {paymentsSortField === field ? (paymentsSortDirection === 'asc' ? '▲' : '▼') : ''}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs divide-y divide-zinc-900">
                        <thead className="bg-zinc-950 text-[9px] font-mono text-zinc-500 uppercase tracking-wider sticky top-0">
                          <tr>
                            <th className="p-3">Transaction ID</th>
                            <th 
                              className="p-3 cursor-pointer hover:text-zinc-300 transition select-none"
                              onClick={() => {
                                if (paymentsSortField === 'user') {
                                  setPaymentsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setPaymentsSortField('user');
                                  setPaymentsSortDirection('asc');
                                }
                              }}
                            >
                              Client Number {paymentsSortField === 'user' ? (paymentsSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </th>
                            <th className="p-3">Purchased Plan</th>
                            <th className="p-3">Order Code</th>
                            <th 
                              className="p-3 cursor-pointer hover:text-zinc-300 transition select-none"
                              onClick={() => {
                                if (paymentsSortField === 'date') {
                                  setPaymentsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setPaymentsSortField('date');
                                  setPaymentsSortDirection('desc');
                                }
                              }}
                            >
                              Timestamp {paymentsSortField === 'date' ? (paymentsSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </th>
                            <th 
                              className="p-3 text-right cursor-pointer hover:text-zinc-300 transition select-none"
                              onClick={() => {
                                if (paymentsSortField === 'amount') {
                                  setPaymentsSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                } else {
                                  setPaymentsSortField('amount');
                                  setPaymentsSortDirection('desc');
                                }
                              }}
                            >
                              Fee Paid {paymentsSortField === 'amount' ? (paymentsSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900 text-[11px]">
                          {filteredSortedPayments.map((p) => (
                            <tr key={p.id} className="hover:bg-zinc-900/20">
                              <td className="p-3 font-mono text-zinc-400">{p.paymentId}</td>
                              <td className="p-3 font-mono font-semibold text-emerald-400">+91 {p.mobileNumber || mobileNumber}</td>
                              <td className="p-3 font-bold text-zinc-200">{p.planName}</td>
                              <td className="p-3 font-mono text-zinc-500">{p.orderId}</td>
                              <td className="p-3 text-zinc-400">{p.date}</td>
                              <td className="p-3 text-right font-mono font-bold text-indigo-400">₹{p.amount}</td>
                            </tr>
                          ))}
                          {filteredSortedPayments.length === 0 && (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-zinc-500 text-[10px]">
                                No payment records match your search queries.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Push Broadcast Alert Panel */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    
                    {/* Send manual push */}
                    <div className="md:col-span-7 bg-zinc-950/40 border border-zinc-850 rounded-xl p-4 space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-zinc-400 block">
                        Push Broadcast System Notifications
                      </span>
                      
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (!adminNotifTitle || !adminNotifMessage) return;
                          try {
                            const bNotif = {
                              id: `NOT-${Math.floor(1000 + Math.random() * 9000)}`,
                              title: adminNotifTitle,
                              message: adminNotifMessage,
                              date: new Date().toISOString().split('T')[0],
                              read: false,
                              mobileNumber: adminNotifRecipient || 'all'
                            };
                            await saveNotification(bNotif);
                            setAdminNotifSuccess('System broadcast successfully pushed to database!');
                            setAdminNotifTitle('');
                            setAdminNotifMessage('');
                            setTimeout(() => setAdminNotifSuccess(''), 4000);
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="space-y-3 text-xs"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-mono text-zinc-500">Recipient Mobile</label>
                            <input
                              type="text"
                              value={adminNotifRecipient}
                              onChange={(e) => setAdminNotifRecipient(e.target.value)}
                              placeholder="all (or specific mobile)"
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase font-mono text-zinc-500">Alert Title</label>
                            <input
                              type="text"
                              value={adminNotifTitle}
                              onChange={(e) => setAdminNotifTitle(e.target.value)}
                              placeholder="e.g. Health Advisory"
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-mono text-zinc-500">Alert Message Body</label>
                          <textarea
                            value={adminNotifMessage}
                            onChange={(e) => setAdminNotifMessage(e.target.value)}
                            placeholder="Write notification context details..."
                            rows={2}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-white focus:outline-none resize-none"
                          />
                        </div>

                        {adminNotifSuccess && (
                          <p className="text-[10px] text-emerald-400 font-mono text-center font-bold">{adminNotifSuccess}</p>
                        )}

                        <button
                          type="submit"
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg cursor-pointer transition text-xs"
                        >
                          Broadcast Push Alert
                        </button>
                      </form>
                    </div>

                    {/* Quick Empanel Hospital */}
                    <div className="md:col-span-5 bg-zinc-950/40 border border-zinc-850 rounded-xl p-4 space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider font-mono text-zinc-400 block">
                        Empanel Facility Node
                      </span>
                      <form onSubmit={handleAddHospital} className="space-y-2 text-xs">
                        <input
                          type="text"
                          placeholder="Hospital Commercial Name"
                          value={newHospitalName}
                          onChange={(e) => setNewHospitalName(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-white outline-none focus:border-indigo-500 text-[11px]"
                        />
                        <input
                          type="text"
                          placeholder="City (e.g. New Delhi)"
                          value={newHospitalCity}
                          onChange={(e) => setNewHospitalCity(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-white outline-none focus:border-indigo-500 text-[11px]"
                        />
                        <input
                          type="text"
                          placeholder="Hotline contact (+91 ...)"
                          value={newHospitalContact}
                          onChange={(e) => setNewHospitalContact(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-white outline-none focus:border-indigo-500 text-[11px]"
                        />
                        <button
                          type="submit"
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 rounded-lg transition text-xs cursor-pointer"
                        >
                          Empanel Hospital
                        </button>
                      </form>
                    </div>

                  </div>

                  {/* Empanelled Hospitals & QR Registry Section */}
                  <div className="border border-zinc-850 rounded-xl overflow-hidden bg-zinc-950/40">
                    <div className="bg-zinc-900/60 px-4 py-2 border-b border-zinc-850 flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                        Empanelled Facilities &amp; QR Code Generator Registry
                      </span>
                      <span className="text-[9px] bg-indigo-950 text-indigo-400 font-bold px-2 py-0.5 rounded font-mono">
                        {filteredSortedHospitals.length} Total Nodes
                      </span>
                    </div>

                    {/* Hospital Search controls */}
                    <div className="bg-zinc-900/30 p-3 border-b border-zinc-850 flex items-center justify-between">
                      <div className="relative w-full md:max-w-xs">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-zinc-500">
                          <Search className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="text"
                          placeholder="Search hospitals (Name, city, contact)..."
                          value={searchHospital}
                          onChange={(e) => setSearchHospital(e.target.value)}
                          className="w-full pl-8 pr-7 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 outline-none focus:border-indigo-500 font-mono"
                        />
                        {searchHospital && (
                          <button
                            onClick={() => setSearchHospital('')}
                            className="absolute inset-y-0 right-0 flex items-center pr-2 text-zinc-500 hover:text-zinc-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        
                        {/* Left Column: Hospital Registry List */}
                        <div className={`${selectedQrHospital ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-3 transition-all duration-300`}>
                          <div className="overflow-x-auto rounded-lg border border-zinc-900 bg-zinc-950">
                            <table className="w-full text-left text-xs divide-y divide-zinc-900">
                              <thead className="bg-zinc-950 text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                                <tr>
                                  <th className="p-3">Hospital ID</th>
                                  <th className="p-3">Facility Name</th>
                                  <th className="p-3">City</th>
                                  <th className="p-3">Contact</th>
                                  <th className="p-3 text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-900 text-[11px]">
                                {filteredSortedHospitals.map((h) => {
                                  const isSelected = selectedQrHospital?.id === h.id;
                                  return (
                                    <tr key={h.id} className={`hover:bg-zinc-900/30 ${isSelected ? 'bg-indigo-950/20 text-white' : 'text-zinc-300'}`}>
                                      <td className="p-3 font-mono text-zinc-500">#{h.id}</td>
                                      <td className="p-3 font-bold">{h.name}</td>
                                      <td className="p-3">
                                        <span className="bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded text-[9px] font-mono">
                                          {h.city}
                                        </span>
                                      </td>
                                      <td className="p-3 font-mono text-zinc-400 text-[10px]">{h.contact}</td>
                                      <td className="p-3 text-center">
                                        <button
                                          onClick={() => {
                                            setSelectedQrHospital(h);
                                            // Pre-populate with empty or default
                                            setQrPreFillDoctor('');
                                            setQrPreFillAmount('');
                                            setQrPreFillDate('');
                                          }}
                                          className={`font-bold text-[9px] px-2.5 py-1 rounded cursor-pointer transition flex items-center gap-1 mx-auto ${
                                            isSelected 
                                              ? 'bg-indigo-500 text-white' 
                                              : 'bg-indigo-950/60 text-indigo-400 border border-indigo-900/40 hover:bg-indigo-900/40'
                                          }`}
                                        >
                                          <QrCode className="w-3 h-3" />
                                          <span>{isSelected ? 'Generating' : 'Generate QR'}</span>
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                                {filteredSortedHospitals.length === 0 && (
                                  <tr>
                                    <td colSpan={5} className="p-4 text-center text-zinc-500 text-[10px] font-mono">
                                      No empanelled hospitals match search query.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Right Column: Custom QR Code Configurator & Preview */}
                        {selectedQrHospital && (
                          <div className="lg:col-span-5 bg-zinc-900/60 border border-zinc-850 rounded-xl p-4 flex flex-col justify-between space-y-4 animate-fade-in relative">
                            {/* Close Button */}
                            <button
                              onClick={() => setSelectedQrHospital(null)}
                              className="absolute top-3 right-3 text-zinc-500 hover:text-white cursor-pointer p-1 rounded hover:bg-zinc-800"
                            >
                              <X className="w-4 h-4" />
                            </button>

                            <div className="space-y-3">
                              <div>
                                <span className="text-[8px] font-mono font-bold text-indigo-400 uppercase tracking-widest block">
                                  QR CONFIGURATOR
                                </span>
                                <h4 className="text-xs font-extrabold text-white truncate max-w-[220px]">
                                  {selectedQrHospital.name}
                                </h4>
                                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                  ID: {selectedQrHospital.id} • {selectedQrHospital.city}
                                </p>
                              </div>

                              <div className="border border-zinc-800 rounded-lg p-2 bg-zinc-950 text-[10px] text-zinc-400 font-mono break-all space-y-1">
                                <span className="text-zinc-500 block text-[9px]">ENCODED PAYLOAD (JSON):</span>
                                <p className="text-zinc-300 font-bold">{`{"hospitalId":"${selectedQrHospital.id}"${qrPreFillDoctor.trim() ? `,"doctorName":"${qrPreFillDoctor.trim()}"` : ''}${qrPreFillAmount.trim() ? `,"billAmount":${qrPreFillAmount.trim()}` : ''}${qrPreFillDate ? `,"date":"${qrPreFillDate}"` : ''}}`}</p>
                              </div>

                              {/* Form controls for pre-fills */}
                              <div className="space-y-2 text-[11px]">
                                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono block">
                                  Receipt Auto-fill Fields (Optional)
                                </span>
                                <div className="space-y-1.5">
                                  <div>
                                    <label className="text-[9px] text-zinc-500 uppercase font-mono">Pre-fill Doctor Name</label>
                                    <input
                                      type="text"
                                      value={qrPreFillDoctor}
                                      onChange={(e) => setQrPreFillDoctor(e.target.value)}
                                      placeholder="e.g. Dr. Satish Mehta"
                                      className="w-full bg-zinc-950 border border-zinc-850 rounded p-1.5 text-white outline-none focus:border-indigo-500"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[9px] text-zinc-500 uppercase font-mono font-bold">Pre-fill Bill Amount</label>
                                      <input
                                        type="number"
                                        value={qrPreFillAmount}
                                        onChange={(e) => setQrPreFillAmount(e.target.value)}
                                        placeholder="₹0.00"
                                        className="w-full bg-zinc-950 border border-zinc-850 rounded p-1.5 text-white outline-none focus:border-indigo-500 font-mono"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] text-zinc-500 uppercase font-mono">Consultation Date</label>
                                      <input
                                        type="date"
                                        value={qrPreFillDate}
                                        onChange={(e) => setQrPreFillDate(e.target.value)}
                                        className="w-full bg-zinc-950 border border-zinc-850 rounded p-1.5 text-white outline-none focus:border-indigo-500 font-mono"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* QR Image Visualizer Card */}
                            <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl flex flex-col items-center justify-center text-center space-y-2">
                              <div className="bg-white p-2.5 rounded-lg shadow-md">
                                <img
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                                    JSON.stringify({
                                      hospitalId: selectedQrHospital.id,
                                      ...(qrPreFillDoctor.trim() ? { doctorName: qrPreFillDoctor.trim() } : {}),
                                      ...(qrPreFillAmount.trim() ? { billAmount: parseFloat(qrPreFillAmount) } : {}),
                                      ...(qrPreFillDate ? { date: qrPreFillDate } : {})
                                    })
                                  )}`}
                                  alt="Generated Hospital QR Code"
                                  className="w-[120px] h-[120px] object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              
                              <p className="text-[9px] text-zinc-500 max-w-[200px]">
                                Scan with OPD receipt scanner to automatically populate claim details.
                              </p>

                              <div className="flex gap-1.5 w-full">
                                <button
                                  onClick={() => {
                                    const jsonText = JSON.stringify({
                                      hospitalId: selectedQrHospital.id,
                                      ...(qrPreFillDoctor.trim() ? { doctorName: qrPreFillDoctor.trim() } : {}),
                                      ...(qrPreFillAmount.trim() ? { billAmount: parseFloat(qrPreFillAmount) } : {}),
                                      ...(qrPreFillDate ? { date: qrPreFillDate } : {})
                                    });
                                    navigator.clipboard.writeText(jsonText);
                                    alert("QR Payload JSON copied to clipboard!");
                                  }}
                                  className="flex-1 bg-zinc-850 hover:bg-zinc-750 text-zinc-300 font-bold text-[9px] py-1 rounded border border-zinc-700 cursor-pointer flex items-center justify-center gap-1"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Payload</span>
                                </button>
                                <a
                                  href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
                                    JSON.stringify({
                                      hospitalId: selectedQrHospital.id,
                                      ...(qrPreFillDoctor.trim() ? { doctorName: qrPreFillDoctor.trim() } : {}),
                                      ...(qrPreFillAmount.trim() ? { billAmount: parseFloat(qrPreFillAmount) } : {}),
                                      ...(qrPreFillDate ? { date: qrPreFillDate } : {})
                                    })
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[9px] py-1 rounded cursor-pointer flex items-center justify-center gap-1 text-center"
                                >
                                  <Scan className="w-3 h-3" />
                                  <span>Download / Print</span>
                                </a>
                              </div>
                            </div>

                          </div>
                        )}

                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* TAB 5: Google Play Console Publishing Assistant & Legal Documents Generator */}
          {activeWorkspaceTab === 'publishing' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-zinc-900 bg-zinc-900/60">
                <h3 className="font-bold text-sm text-white">Google Play Store Publishing Desk</h3>
                <p className="text-[11px] text-zinc-400">Complete production build checklists, APK signing keys, and automated legal generators</p>
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
                
                {/* Steps and selections */}
                <div className="md:col-span-5 border-r border-zinc-900 overflow-y-auto bg-zinc-950/20 p-4 space-y-4 text-xs">
                  
                  {/* Step APK Section */}
                  <div className="space-y-2.5">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Flutter Signed APK Steps</span>
                    
                    <div className="space-y-2 font-mono text-[10px]">
                      
                      <div className="bg-zinc-900/60 p-2.5 border border-zinc-850 rounded-lg space-y-1">
                        <span className="font-bold text-indigo-400">Step 1: Generate Keystore</span>
                        <p className="text-zinc-400 text-[9px] leading-relaxed">Execute keytool command to compile a private upload signature certificate:</p>
                        <pre className="bg-zinc-950 p-1.5 rounded text-[8px] text-zinc-300 overflow-x-auto whitespace-pre font-mono">
                          {`keytool -genkey -v -keystore ~/upload-keystore.jks \\
  -storetype JKS -keyalg RSA -keysize 2048 \\
  -validity 10000 -alias upload`}
                        </pre>
                      </div>

                      <div className="bg-zinc-900/60 p-2.5 border border-zinc-850 rounded-lg space-y-1">
                        <span className="font-bold text-indigo-400">Step 2: Configure key.properties</span>
                        <p className="text-zinc-400 text-[9px]">Create `android/key.properties` with reference paths:</p>
                        <pre className="bg-zinc-950 p-1.5 rounded text-[8px] text-zinc-300 font-mono">
                          {`storePassword=mykeystorepass
keyPassword=mykeypass
keyAlias=upload
storeFile=/Users/dev/upload-keystore.jks`}
                        </pre>
                      </div>

                      <div className="bg-zinc-900/60 p-2.5 border border-zinc-850 rounded-lg space-y-1">
                        <span className="font-bold text-indigo-400">Step 3: Trigger Production Release Build</span>
                        <p className="text-zinc-400 text-[9px]">Execute the release APK and AAB bundle compilers:</p>
                        <pre className="bg-zinc-950 p-1.5 rounded text-[8px] text-zinc-300 font-mono">
                          {`flutter build apk --release
flutter build appbundle --release`}
                        </pre>
                      </div>

                    </div>
                  </div>

                  {/* Document Toggle */}
                  <div className="space-y-2 pt-2 border-t border-zinc-900">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Legal Console Generator</span>
                    
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => setSelectedDocType('privacy')}
                        className={`py-2 text-[10px] font-bold rounded-lg border text-center cursor-pointer transition ${
                          selectedDocType === 'privacy' ? 'bg-indigo-950/60 border-indigo-500/80 text-indigo-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        Privacy Policy
                      </button>
                      <button
                        onClick={() => setSelectedDocType('terms')}
                        className={`py-2 text-[10px] font-bold rounded-lg border text-center cursor-pointer transition ${
                          selectedDocType === 'terms' ? 'bg-indigo-950/60 border-indigo-500/80 text-indigo-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        Terms &amp; Conditions
                      </button>
                    </div>
                  </div>

                </div>

                {/* Document Display and Exports */}
                <div className="md:col-span-7 p-5 overflow-y-auto flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                          {selectedDocType === 'privacy' ? 'Custom Privacy Policy Document' : 'Custom Terms & Conditions Document'}
                        </h4>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Automated compilation matching GP Console compliance</p>
                      </div>

                      {/* Export buttons */}
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            const titleStr = selectedDocType === 'privacy' ? 'Privacy Policy - Gemini Care' : 'Terms and Conditions - Gemini Care';
                            const fullContent = selectedDocType === 'privacy' 
                              ? `# Privacy Policy for Gemini Care\n\nLast updated: July 03, 2026\n\nGemini Care ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how your personal and health information is collected, used, and safeguarded when you use the Gemini Care mobile application.\n\n## 1. Information We Collect\n- **Personal Profile Data**: Name, phone number, and subscription status.\n- **Health & Clinical Metrics**: Age, height, weight, and health co-morbidities (Diabetes, Blood Pressure) which you voluntarily enter into our AI Diet Planner.\n- **OPD Claim Invoices**: Receipts, doctor name, consultation dates, and reimbursement amounts uploaded for cashless claim processing.\n- **Chat Logs**: Anonymous conversations with our AI Health Companion.\n\n## 2. How We Use Your Information\n- To generate personalized nutrition, calorie targets, and diet profiles.\n- To verify your identity via secure OTP and process OPD cashback refunds.\n- To improve our clinical algorithms using the server-side Gemini API.\n- We **NEVER** sell or share your clinical data with third-party advertising networks.\n\n## 3. Data Storage & Security\nAll profiles, payments, and claims are securely stored in our cloud database. You may request account deletion and complete erasure of your claim records by contacting our support team at devbhakti173@gmail.com.\n\n---\n*Disclaimer: Gemini Care provides AI-driven lifestyle recommendations. It is not a substitute for professional medical diagnosis or emergency advice.*`
                              : `# Terms & Conditions for Gemini Care\n\nLast updated: July 03, 2026\n\nWelcome to Gemini Care. By registering an account and purchasing our OPD health subscription plans, you agree to comply with the following terms:\n\n## 1. OPD Payout Reimbursement Rules\n- **Starter Plans (Bronze/Silver)** provide a fixed number of annual or monthly claim allowances (1 and 4 claims respectively).\n- **Gold VIP Plan** provides unlimited claim submissions subject to fair-use verification.\n- All claim approvals are reviewed by clinical platform administrators. Approved amounts are disbursed directly to your virtual wellness wallet and are fully refundable.\n\n## 2. Subscription Fees & Gateway Security\n- All subscription payments are processed securely via the integrated Razorpay Payment Gateway.\n- Subscriptions are activate immediately upon authorization. No refunds will be provided for partially used billing cycles.\n\n## 3. Disclaimer of Medical Liability\nGemini Care is a digital sandbox. Our AI Health Companion and Diet Planner do not prescribe medication or diagnose medical conditions. Consult a qualified physician for any diagnostic or emergency medical events.`;
                            exportToMarkdown(titleStr, 'Legal Compliance Copy', fullContent);
                          }}
                          className="text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold px-2.5 py-1 rounded cursor-pointer hover:text-white"
                        >
                          Export Markdown
                        </button>
                        <button
                          onClick={() => {
                            const titleStr = selectedDocType === 'privacy' ? 'Privacy Policy - Gemini Care' : 'Terms and Conditions - Gemini Care';
                            const rawContent = selectedDocType === 'privacy'
                              ? `Privacy Policy for Gemini Care. Last updated: July 03, 2026. This Privacy Policy explains how your personal and health information is collected, used, and safeguarded when you use the Gemini Care mobile application. Personal Profile Data: Name, phone number, and subscription status. Health & Clinical Metrics: Age, height, weight, and health co-morbidities (Diabetes, Blood Pressure) which you voluntarily enter into our AI Diet Planner. OPD Claim Invoices: Receipts, doctor name, consultation dates, and reimbursement amounts uploaded for cashless claim processing. Chat Logs: Anonymous conversations with our AI Health Companion. We NEVER sell or share your clinical data with third-party advertising networks. You may request account deletion by emailing devbhakti173@gmail.com. Disclaimer: Gemini Care provides AI-driven lifestyle recommendations. It is not a substitute for professional medical diagnosis.`
                              : `Terms & Conditions for Gemini Care. Last updated: July 03, 2026. Welcome to Gemini Care. By registering an account and purchasing our OPD health subscription plans, you agree to comply with these terms. OPD Payout Reimbursement Rules: Bronze/Silver plans provide 1 and 4 claims respectively. Gold VIP Plan provides unlimited claims subject to fair-use verification. All subscriptions processed via Razorpay. Subscriptions activate immediately. Disclaimer of Medical Liability: Gemini Care is a digital sandbox. AI Health Companion and Diet Planner do not perform clinical diagnoses or prescribe medication. Consult a physician for emergencies.`;
                            exportToPdf(titleStr, 'Legal compliance copy', rawContent);
                          }}
                          className="text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold px-2.5 py-1 rounded cursor-pointer hover:text-white"
                        >
                          Export PDF
                        </button>
                      </div>
                    </div>

                    {/* Pre-formatted legal render block */}
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 h-96 overflow-y-auto text-xs text-zinc-300 leading-relaxed space-y-3 font-sans">
                      {selectedDocType === 'privacy' ? (
                        <>
                          <h5 className="text-sm font-extrabold text-white">Privacy Policy for Gemini Care</h5>
                          <p className="text-[10px] text-zinc-500 font-mono">Last updated: July 03, 2026</p>
                          <p>
                            Gemini Care ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how your personal and health information is collected, used, and safeguarded when you use the Gemini Care mobile application.
                          </p>
                          <h6 className="font-bold text-white mt-3">1. Information We Collect</h6>
                          <ul className="list-disc pl-4 space-y-1">
                            <li><strong>Personal Profile Data:</strong> Name, phone number, and subscription status.</li>
                            <li><strong>Health &amp; Clinical Metrics:</strong> Age, height, weight, and health co-morbidities (Diabetes, Blood Pressure) which you voluntarily enter into our AI Diet Planner.</li>
                            <li><strong>OPD Claim Invoices:</strong> Receipts, doctor name, consultation dates, and reimbursement amounts uploaded for cashless claim processing.</li>
                            <li><strong>Chat Logs:</strong> Anonymous conversations with our AI Health Companion.</li>
                          </ul>
                          <h6 className="font-bold text-white mt-3">2. How We Use Your Information</h6>
                          <p>
                            We use your metrics solely to generate personalized nutrition plans and calculate calorie targets. All claims processing data is synchronized with your verified Firestore node to process instant virtual refunds. We <strong>NEVER</strong> sell, rent, or distribute your private clinical records.
                          </p>
                          <h6 className="font-bold text-white mt-3">3. Data Deletion Rights</h6>
                          <p>
                            You hold absolute control over your private records. You may request account deletion and complete database wipeouts by emailing our certified privacy desk at <strong>devbhakti173@gmail.com</strong>.
                          </p>
                        </>
                      ) : (
                        <>
                          <h5 className="text-sm font-extrabold text-white">Terms &amp; Conditions for Gemini Care</h5>
                          <p className="text-[10px] text-zinc-500 font-mono">Last updated: July 03, 2026</p>
                          <p>
                            Welcome to Gemini Care. By registering an account and purchasing our OPD health subscription plans, you agree to comply with the following terms:
                          </p>
                          <h6 className="font-bold text-white mt-3">1. OPD Reimbursement Rules</h6>
                          <ul className="list-disc pl-4 space-y-1">
                            <li><strong>Starter Plans (Bronze/Silver):</strong> provide 1 and 4 claims respectively per billing cycle.</li>
                            <li><strong>Gold VIP Plan:</strong> provides unlimited claim submissions subject to fair-use validation.</li>
                            <li>All claims are subject to administrative review. Approved payout cashbacks are credited directly to your virtual wellness wallet and are fully refundable.</li>
                          </ul>
                          <h6 className="font-bold text-white mt-3">2. Subscription Fees &amp; Payments</h6>
                          <p>
                            All subscription fees are processed securely via the integrated Razorpay Payment Gateway. Subscriptions activate immediately upon successful order processing.
                          </p>
                          <h6 className="font-bold text-white mt-3">3. Disclaimer of Medical Liability</h6>
                          <p>
                            Gemini Care is a digital sandbox. Our AI Health Companion and Diet Planner do not prescribe medication or diagnose medical conditions. Always consult a qualified physician for emergencies.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>

      </main>

      {/* Footer Info block */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 px-6 py-4.5 text-center flex flex-col md:flex-row items-center justify-between gap-2.5">
        <p className="text-[11px] text-zinc-500">
          Crafted with care using Flutter Clean Architecture templates and Material 3 guidelines.
        </p>
        <p className="text-[10px] text-zinc-600 font-mono">
          Gemini Studio Companion © 2026. Fully functional sandbox simulation.
        </p>
      </footer>
    </div>
  );
}
