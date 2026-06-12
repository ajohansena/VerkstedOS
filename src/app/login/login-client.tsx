'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Messages } from '@/lib/i18n/messages/nb';
import { createClient } from '@/lib/supabase/client';

type Labels = Messages['login'];

export default function LoginPageClient({ labels }: { labels: Labels }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(params.get('error'));
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) {
        setError(authError.message);
        setPending(false);
        return;
      }
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{labels.title}</CardTitle>
          <CardDescription>{labels.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                {labels.email}
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                {labels.password}
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? labels.submitting : labels.submit}
            </Button>
          </form>

          <div className="mt-6 border-t pt-4">
            <p className="mb-3 text-center text-xs text-muted-foreground">
              {labels.notYet}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <a
                href="mailto:demo@verkstedos.no?subject=Demo%20request%20-%20VerkstedOS&body=Hei%2C%0A%0AJeg%20%C3%B8nsker%20en%20demo%20av%20VerkstedOS.%0A%0AVerksted%2Forganisasjon%3A%20%0AKontaktperson%3A%20%0ATelefon%3A%20%0A%0AMed%20vennlig%20hilsen"
                className="rounded-md border border-input px-3 py-2 text-center text-sm hover:bg-accent"
              >
                {labels.requestDemo}
              </a>
              <a
                href="mailto:sales@verkstedos.no?subject=Sales%20inquiry%20-%20VerkstedOS&body=Hei%2C%0A%0AJeg%20vil%20gjerne%20snakke%20med%20en%20selger.%0A%0AVerksted%2Forganisasjon%3A%20%0AKontaktperson%3A%20%0ATelefon%3A%20%0A%0AMed%20vennlig%20hilsen"
                className="rounded-md border border-input px-3 py-2 text-center text-sm hover:bg-accent"
              >
                {labels.contactSales}
              </a>
            </div>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {labels.noSelfService}
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
