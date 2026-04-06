import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface InfoPopupData {
  title: string;
  content: string;
}

/**
 * Hook que gerencia o popup informativo automaticamente.
 *
 * - Busca o popup do Supabase
 * - Escuta evento 'ageVerified' para abrir automaticamente após verificação de idade
 * - Usa sessionStorage para não mostrar novamente
 */
export const useInfoPopup = () => {
  const [infoPopup, setInfoPopup] = useState<InfoPopupData | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    try {
      sessionStorage.setItem('info_popup_seen', 'true');
    } catch (e) {
      // Ignore errors
    }
  }, []);

  useEffect(() => {
    // Verifica se já viu o popup antes
    try {
      if (sessionStorage.getItem('info_popup_seen') === 'true') {
        return; // Já viu, não precisa buscar nem mostrar
      }
    } catch (e) {
      // Ignore errors, continue normally
    }

    // Busca o popup do banco
    const fetchPopup = async () => {
      try {
        const { data, error } = await supabase
          .from('informational_popups')
          .select('title, content')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setInfoPopup(data);
        }
      } catch (e) {
        console.error('[useInfoPopup] Error fetching popup:', e);
      }
    };

    fetchPopup();

    // Escuta evento de verificação de idade para abrir automaticamente
    const handleAgeVerified = () => {
      // Só abre se houver dados do popup e ainda não foi visto
      if (infoPopup && sessionStorage.getItem('info_popup_seen') !== 'true') {
        setIsOpen(true);
      }
    };

    window.addEventListener('ageVerified', handleAgeVerified);

    return () => {
      window.removeEventListener('ageVerified', handleAgeVerified);
    };
  }, [infoPopup]);

  return { infoPopup, isOpen, onClose: handleClose };
};
