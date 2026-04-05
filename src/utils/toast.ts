import { toast } from "sonner";

export const showSuccess = (message: string) => {
  toast.success(message, { duration: 1500 });
};

export const showError = (message: string) => {
  toast.error(message, { duration: 3000 });
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string | number) => {
  toast.dismiss(toastId);
};