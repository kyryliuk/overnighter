import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase/client'

export interface SubscriptionState {
  isPremium: boolean
  isTrial: boolean
  status: string
  isLoading: boolean
}

export function useSubscription(): SubscriptionState {
  const { session, isAuthenticated } = useAuth()
  const userId = session?.user?.id

  const { data: status, isLoading } = useQuery({
    queryKey: ['subscription', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_status')
        .eq('id', userId!)
        .single()

      if (error) throw error
      return data.subscription_status as string
    },
    enabled: !!userId && isAuthenticated,
    refetchOnWindowFocus: true,
  })

  if (!isAuthenticated || !userId) {
    return { isPremium: false, isTrial: false, status: 'free', isLoading: false }
  }

  const resolvedStatus = status ?? 'free'

  return {
    isPremium: resolvedStatus === 'premium' || resolvedStatus === 'trialing',
    isTrial: resolvedStatus === 'trialing',
    status: resolvedStatus,
    isLoading,
  }
}
