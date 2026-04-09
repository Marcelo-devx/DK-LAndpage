import { useEffect, useState, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { showError, showLoading, dismissToast, showSuccess } from '@/utils/toast';
import { Loader2, Search, CreditCard, MessageSquare, MapPin, Gift, X, AlertTriangle, CheckCircle2, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';
import { getLocalCart, ItemType, clearLocalCart } from '@/utils/localCart';
import { maskCep, maskPhone, maskCpfCnpj } from '@/utils/masks';
import CouponsModal from '@/components/CouponsModal';
import { cn } from '@/lib/utils';
import { differenceInDays, endOfWeek, isSameWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProductImage from '@/components/ProductImage';
import MercadoPagoCardForm from '@/components/MercadoPagoCardForm';
import { useIsMobile } from '@/hooks/use-mobile';

interface DisplayItem {