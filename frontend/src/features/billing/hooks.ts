import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { billingApi } from "@/services";
import type { Invoice, Plan, Subscription, SubscriptionTier } from "@/types/api";

export const billingKeys = {
  plans: ["billing", "plans"] as const,
  subscription: ["billing", "subscription"] as const,
  invoices: ["billing", "invoices"] as const,
};

export function usePlans() {
  return useQuery<Plan[]>({
    queryKey: billingKeys.plans,
    queryFn: () => billingApi.plans(),
  });
}

export function useSubscription() {
  return useQuery<Subscription>({
    queryKey: billingKeys.subscription,
    queryFn: () => billingApi.subscription(),
  });
}

export function useInvoices() {
  return useQuery<Invoice[]>({
    queryKey: billingKeys.invoices,
    queryFn: () => billingApi.invoices(),
  });
}

export function useChangePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan: SubscriptionTier) => billingApi.changePlan(plan),
    onSuccess: (sub) => qc.setQueryData(billingKeys.subscription, sub),
  });
}
