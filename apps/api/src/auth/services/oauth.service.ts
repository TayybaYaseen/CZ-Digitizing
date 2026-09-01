import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiException } from '../../common/exceptions/api-exception';
import type { Env } from '../../config/env.validation';

export type OAuthProvider = 'google' | 'facebook';

interface ProviderConfig {
  clientId?: string;
  clientSecret?: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
}

export interface OAuthProfile {
  email: string;
  emailVerified: boolean;
  displayName?: string;
}

// AC-10 — Google/Facebook OAuth via a direct authorization-code exchange (fetch), not
// passport strategies: this is a stateless JSON API, not a session-based web app, so passport's
// session/serialize ceremony would add indirection without benefit. Either provider is inert
// (buildAuthorizationUrl/exchangeCode throw a clear 501-style error) until its client id/secret
// env pair is set.
@Injectable()
export class OAuthService {
  private readonly configs: Record<OAuthProvider, ProviderConfig>;
  private readonly apiBaseUrl: string;

  constructor(config: ConfigService<Env, true>) {
    this.apiBaseUrl = config.get('API_BASE_URL', { infer: true });
    this.configs = {
      google: {
        clientId: config.get('GOOGLE_CLIENT_ID', { infer: true }),
        clientSecret: config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
        authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scope: 'openid email profile',
      },
      facebook: {
        clientId: config.get('FACEBOOK_CLIENT_ID', { infer: true }),
        clientSecret: config.get('FACEBOOK_CLIENT_SECRET', { infer: true }),
        authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
        tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
        scope: 'email public_profile',
      },
    };
  }

  private assertConfigured(provider: OAuthProvider): ProviderConfig {
    const cfg = this.configs[provider];
    if (!cfg.clientId || !cfg.clientSecret) {
      throw new ApiException('VALIDATION_ERROR', 501, `OAuth provider "${provider}" is not configured`);
    }
    return cfg;
  }

  private redirectUri(provider: OAuthProvider): string {
    return `${this.apiBaseUrl}/api/auth/oauth/${provider}/callback`;
  }

  buildAuthorizationUrl(provider: OAuthProvider, state: string): string {
    const cfg = this.assertConfigured(provider);
    const params = new URLSearchParams({
      client_id: cfg.clientId!,
      redirect_uri: this.redirectUri(provider),
      response_type: 'code',
      scope: cfg.scope,
      state,
    });
    return `${cfg.authorizeUrl}?${params.toString()}`;
  }

  async exchangeCodeForProfile(provider: OAuthProvider, code: string): Promise<OAuthProfile> {
    const cfg = this.assertConfigured(provider);
    const tokenResponse = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.clientId!,
        client_secret: cfg.clientSecret!,
        code,
        redirect_uri: this.redirectUri(provider),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) {
      throw new ApiException('VALIDATION_ERROR', 401, 'OAuth code exchange failed');
    }
    const { access_token: accessToken } = (await tokenResponse.json()) as { access_token: string };

    return provider === 'google' ? this.fetchGoogleProfile(accessToken) : this.fetchFacebookProfile(accessToken);
  }

  private async fetchGoogleProfile(accessToken: string): Promise<OAuthProfile> {
    const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = (await res.json()) as { email: string; email_verified: boolean; name?: string };
    return { email: profile.email, emailVerified: profile.email_verified, displayName: profile.name };
  }

  private async fetchFacebookProfile(accessToken: string): Promise<OAuthProfile> {
    const url = new URL('https://graph.facebook.com/me');
    url.searchParams.set('fields', 'id,name,email');
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url);
    const profile = (await res.json()) as { email?: string; name?: string };
    if (!profile.email) {
      throw new ApiException('VALIDATION_ERROR', 401, 'Facebook account has no verified email');
    }
    // Facebook only returns an email at all once the user has verified it on their account.
    return { email: profile.email, emailVerified: true, displayName: profile.name };
  }
}
