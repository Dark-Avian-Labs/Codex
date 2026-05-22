const clerkFontFamily =
  "'Geist Variable', Geist, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

function clerkThemeVariables() {
  return {
    colorPrimary: 'var(--color-accent)',
    colorDanger: 'var(--color-danger)',
    colorSuccess: 'var(--color-success)',
    colorWarning: 'var(--color-warning)',
    colorNeutral: 'var(--color-muted)',
    borderRadius: '1rem',
    fontFamily: clerkFontFamily,
    fontSize: '14px',
    spacingUnit: '0.9rem',
  };
}

function clerkFormElements() {
  return {
    formFieldLabel: 'cl-field-label',
    formFieldInput: 'cl-field-input',
    formButtonPrimary: 'cl-dal-btn',
    formButtonReset: 'cl-dal-btn',
    formFieldInputShowPasswordButton: 'cl-show-password text-muted',
    alertText: 'text-danger text-sm',
    formResendCodeLink: 'cl-footer-link text-sm',
  };
}

export function buildClerkAppearance() {
  return {
    variables: {
      ...clerkThemeVariables(),
      colorText: 'var(--color-foreground)',
      colorTextSecondary: 'var(--color-muted)',
      colorBackground: 'transparent',
      colorInputBackground: 'var(--color-glass-hover)',
      colorInputText: 'var(--color-foreground)',
    },
    layout: {
      socialButtonsPlacement: 'bottom' as const,
      socialButtonsVariant: 'iconButton' as const,
      shimmer: false,
      logoPlacement: 'none' as const,
    },
    elements: {
      ...clerkFormElements(),
      rootBox: 'cl-root w-full',
      cardBox: 'cl-card-box w-full shadow-none',
      card: 'cl-card-inner w-full bg-transparent shadow-none border-0 p-0',
      main: 'cl-main gap-4',
      logoBox: 'hidden',
      logoImage: 'hidden',
      header: 'hidden',
      headerTitle: 'hidden',
      headerSubtitle: 'hidden',
      socialButtons: 'cl-social-row',
      socialButtonsIconButton: 'cl-social-btn',
      dividerRow: 'cl-divider-row',
      dividerLine: 'cl-divider-line',
      dividerText: 'cl-divider-text',
      form: 'cl-form gap-3',
      formFieldRow: 'cl-field-row',
      alternativeMethodsBlockButton: 'cl-dal-btn',
      alternativeMethodsBlockButtonText: 'cl-btn-block-text',
      alternativeMethodsBlockButtonArrow: 'cl-btn-block-arrow',
      backLink: 'cl-back-link',
      headerBackLink: 'cl-back-link',
      footer: 'cl-footer',
      footerAction: 'cl-footer-action',
      footerActionLink: 'cl-footer-link',
      footerActionText: 'cl-footer-text',
      footerPages: 'clerk-secured-strip',
      footerPagesLink: 'clerk-secured-link',
      identityPreview: 'cl-identity-preview',
      identityPreviewText: 'text-foreground text-sm',
      identityPreviewEditButton: 'cl-footer-link text-sm',
      alert: 'cl-alert',
      otpCodeField: 'cl-otp-field',
      otpCodeFieldInputs: 'cl-otp-inputs',
      otpCodeFieldInputContainer: 'cl-otp-cell-wrap',
      otpCodeFieldInput: 'cl-otp-cell',
      otpCodeFieldErrorText: 'text-danger text-sm',
      otpCodeFieldSuccessText: 'text-muted text-sm',
      navbar: 'hidden',
      navbarMobileMenuButton: 'hidden',
    },
  };
}

export function buildClerkProfileAppearance() {
  return {
    variables: {
      ...clerkThemeVariables(),
      colorForeground: 'var(--color-foreground)',
      colorMutedForeground: 'var(--color-muted)',
      colorBackground: 'var(--color-surface-400)',
      colorModalBackdrop: 'oklch(0% 0 0 / 0.7)',
      colorBorder: 'var(--color-glass-border)',
      colorInput: 'var(--color-glass-hover)',
      colorInputForeground: 'var(--color-foreground)',
    },
    elements: {
      ...clerkFormElements(),
      modalBackdrop: 'clerk-profile-backdrop',
      modalContent: 'clerk-profile-modal',
      cardBox: 'clerk-profile-glass',
      card: 'clerk-profile-card',
      navbar: 'clerk-profile-navbar',
      navbarButton: 'clerk-profile-nav-btn',
      pageScrollBox: 'clerk-profile-scroll',
      profilePage: 'clerk-profile-page',
      scrollBox: 'clerk-profile-scroll',
    },
  };
}
