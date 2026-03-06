import {
  cloneElement,
  isValidElement,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactElement,
} from 'react';

type ButtonVariant = 'accent' | 'secondary' | 'danger';

function variantClass(variant: ButtonVariant): string {
  switch (variant) {
    case 'accent':
      return 'btn-accent';
    case 'secondary':
      return 'btn-secondary';
    case 'danger':
      return 'btn-danger';
  }
  const exhaustiveVariant: never = variant;
  throw new Error(`Unhandled ButtonVariant: ${exhaustiveVariant}`);
}

interface BaseProps {
  variant?: ButtonVariant;
  className?: string;
  asChild?: boolean;
}

interface ButtonProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>,
    BaseProps {
  href?: never;
}

interface LinkButtonProps
  extends
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'>,
    BaseProps {
  href: string;
}

function composeClassName(variant: ButtonVariant, className?: string): string {
  const classes = ['btn', variantClass(variant)];
  if (className) {
    classes.push(className);
  }
  return classes.join(' ');
}

export function Button(props: ButtonProps | LinkButtonProps) {
  const { children, variant = 'secondary', className, asChild } = props;
  const classes = composeClassName(variant, className);

  if (asChild) {
    if (!isValidElement(children)) {
      if (process.env.NODE_ENV !== 'production') {
        const childType =
          children === null
            ? 'null'
            : Array.isArray(children)
              ? 'array'
              : typeof children;
        console.warn(
          `[Button] "asChild" requires a single valid React element child; received ${childType}.`,
        );
      }
      return null;
    }

    const {
      children: _children,
      variant: _variant,
      className: _className,
      asChild: _asChild,
      ...childProps
    } = props as ButtonProps;

    type ChildProps = HTMLAttributes<HTMLElement> & Record<string, unknown>;
    const child = children as ReactElement<ChildProps>;
    const childClassName = child.props.className;
    const mergedClassName = [classes, childClassName].filter(Boolean).join(' ');

    const mergedProps: Partial<ChildProps> = {
      ...(childProps as Partial<ChildProps>),
    };

    for (const [key, childValue] of Object.entries(
      child.props as Record<string, unknown>,
    )) {
      const buttonValue = mergedProps[key as keyof ChildProps];
      if (
        key.startsWith('on') &&
        typeof buttonValue === 'function' &&
        typeof childValue === 'function'
      ) {
        mergedProps[key as keyof ChildProps] = ((...args: unknown[]) => {
          (buttonValue as (...handlerArgs: unknown[]) => void)(...args);
          (childValue as (...handlerArgs: unknown[]) => void)(...args);
        }) as ChildProps[keyof ChildProps];
        continue;
      }

      mergedProps[key as keyof ChildProps] =
        childValue as ChildProps[keyof ChildProps];
    }

    mergedProps.className = mergedClassName;

    return cloneElement(child, mergedProps);
  }

  if ('href' in props && props.href) {
    const {
      href,
      variant: _variant,
      className: _className,
      asChild: _asChild,
      ...anchorProps
    } = props;
    return (
      <a href={href} className={classes} {...anchorProps}>
        {children}
      </a>
    );
  }

  const {
    variant: _variant,
    className: _className,
    asChild: _asChild,
    ...buttonProps
  } = props as ButtonProps;
  return (
    <button type="button" {...buttonProps} className={classes}>
      {children}
    </button>
  );
}
