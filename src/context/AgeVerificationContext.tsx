import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AgeVerificationPopup from '@/components/AgeVerificationPopup';
import NotFound from '@/pages/NotFound';

interface AgeVerificationContextType {
  isVerified: boolean;
  verify: () => void;
}

const AgeVerificationContext = createContext<AgeVerificationContextType | undefined>(undefined);

export const useAgeVerification = () => {
  const context = useContext(AgeVerificationContext);
  if (!context) {
    throw new Error('useAgeVerification must be used within an AgeVerificationProvider');
  }
  return context;
};

// Síncrono para evitar flash de conteúdo
const checkInitialVerification = () => {
  try {
    return sessionStorage.getItem('age-verified-v2') === 'true';
  } catch (error) {
    return false;
  }
};

export const AgeVerificationProvider = ({ children }: { children: ReactNode }) => {
  const [isVerified, setIsVerified] = useState(checkInitialVerification);
  const [isBlocked, setIsBlocked] = useState(false);

  const verify = () => {
    sessionStorage.setItem('age-verified-v2', 'true');
    setIsVerified(true);
    window.dispatchEvent(new Event('ageVerified')); // Mantém o evento para o popup informativo
  };

  const block = () => {
    setIsBlocked(true);
  };

  if (isBlocked) {
    return <NotFound />;
  }

  if (!isVerified) {
    return <AgeVerificationPopup onConfirm={verify} onExit={block} />;
  }

  return (
    <AgeVerificationContext.Provider value={{ isVerified, verify }}>
      {children}
    </AgeVerificationContext.Provider>
  );
};