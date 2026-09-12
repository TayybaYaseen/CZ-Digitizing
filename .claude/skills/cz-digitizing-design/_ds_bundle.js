/* @ds-bundle: {"format":4,"namespace":"CZDigitizingDesignSystem_765273","components":[{"name":"Eyebrow","sourcePath":"components/brand/Eyebrow.jsx"},{"name":"GoldRule","sourcePath":"components/brand/GoldRule.jsx"},{"name":"Icon","sourcePath":"components/brand/Icon.jsx"},{"name":"IconTile","sourcePath":"components/brand/IconTile.jsx"},{"name":"Logo","sourcePath":"components/brand/Logo.jsx"},{"name":"Accordion","sourcePath":"components/core/Accordion.jsx"},{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Pagination","sourcePath":"components/core/Pagination.jsx"},{"name":"SegmentedToggle","sourcePath":"components/core/SegmentedToggle.jsx"},{"name":"Tabs","sourcePath":"components/core/Tabs.jsx"},{"name":"ActivityRow","sourcePath":"components/data/ActivityRow.jsx"},{"name":"BarChart","sourcePath":"components/data/BarChart.jsx"},{"name":"DataTable","sourcePath":"components/data/DataTable.jsx"},{"name":"DonutStat","sourcePath":"components/data/DonutStat.jsx"},{"name":"LineChart","sourcePath":"components/data/LineChart.jsx"},{"name":"StatCard","sourcePath":"components/data/StatCard.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"FileField","sourcePath":"components/forms/FileField.jsx"},{"name":"FormField","sourcePath":"components/forms/FormField.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"SearchField","sourcePath":"components/forms/SearchField.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"CreditPack","sourcePath":"components/marketing/CreditPack.jsx"},{"name":"FeatureItem","sourcePath":"components/marketing/FeatureItem.jsx"},{"name":"FlagChip","sourcePath":"components/marketing/FlagChip.jsx"},{"name":"PricingCard","sourcePath":"components/marketing/PricingCard.jsx"},{"name":"ServiceCard","sourcePath":"components/marketing/ServiceCard.jsx"},{"name":"TestimonialCard","sourcePath":"components/marketing/TestimonialCard.jsx"},{"name":"SidebarNav","sourcePath":"components/navigation/SidebarNav.jsx"},{"name":"SiteHeader","sourcePath":"components/navigation/SiteHeader.jsx"},{"name":"TopBar","sourcePath":"components/navigation/TopBar.jsx"}],"sourceHashes":{"components/brand/Eyebrow.jsx":"309d8f6ec8f8","components/brand/GoldRule.jsx":"fe783ae01ec8","components/brand/Icon.jsx":"2ea94481a999","components/brand/IconTile.jsx":"c101e91d5190","components/brand/Logo.jsx":"79ce754e80a5","components/core/Accordion.jsx":"4a5f47f098af","components/core/Avatar.jsx":"bed83d0bca91","components/core/Badge.jsx":"a3bad235fbb6","components/core/Button.jsx":"ca575e4eba17","components/core/Card.jsx":"cfef9826e0e6","components/core/IconButton.jsx":"acdc038680f7","components/core/Pagination.jsx":"6964741c081f","components/core/SegmentedToggle.jsx":"7c953f37f0ed","components/core/Tabs.jsx":"aa07094283cd","components/data/ActivityRow.jsx":"a036c7375a7b","components/data/BarChart.jsx":"f7eca8d817ed","components/data/DataTable.jsx":"da4ebf546bb9","components/data/DonutStat.jsx":"dd69709c4dcd","components/data/LineChart.jsx":"4a29adc98be9","components/data/StatCard.jsx":"25a6f175fbd2","components/forms/Checkbox.jsx":"9b4487b7953e","components/forms/FileField.jsx":"c1f6b91c573b","components/forms/FormField.jsx":"3ad7deb9286a","components/forms/Input.jsx":"0eed8e615f0a","components/forms/Radio.jsx":"4258be5ddafd","components/forms/SearchField.jsx":"dc4b090e3a14","components/forms/Select.jsx":"7934295b8a08","components/forms/Textarea.jsx":"07cde64b89c3","components/marketing/CreditPack.jsx":"2da38b5623aa","components/marketing/FeatureItem.jsx":"2857437f3441","components/marketing/FlagChip.jsx":"37b5d1897c27","components/marketing/PricingCard.jsx":"4ae8f37da602","components/marketing/ServiceCard.jsx":"fa3ca01ab8b6","components/marketing/TestimonialCard.jsx":"3be99a29c4a6","components/navigation/SidebarNav.jsx":"bb0682421905","components/navigation/SiteHeader.jsx":"677bad8cfeb9","components/navigation/TopBar.jsx":"827c8605a2b6","ui_kits/admin_panel/ActivityView.jsx":"825275aebd83","ui_kits/admin_panel/AdminData.jsx":"a7e83ffd8c6c","ui_kits/admin_panel/AdminShell.jsx":"d96e093798f1","ui_kits/admin_panel/CustomersView.jsx":"729b44f21aa9","ui_kits/admin_panel/DashboardView.jsx":"0d6d77909cf5","ui_kits/admin_panel/DesignsView.jsx":"0b424264d405","ui_kits/admin_panel/OrdersView.jsx":"30ae57f37c73","ui_kits/admin_panel/ReportsView.jsx":"ce2f50c7a235","ui_kits/website/CartPage.jsx":"31179ae42216","ui_kits/website/HomePage.jsx":"85f8514a8f84","ui_kits/website/PricingPage.jsx":"1b8d848e53e8","ui_kits/website/QuotePage.jsx":"377226e286b2","ui_kits/website/ServicesPage.jsx":"2ef9ca806134","ui_kits/website/SiteChrome.jsx":"074c3455c152"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.CZDigitizingDesignSystem_765273 = window.CZDigitizingDesignSystem_765273 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Eyebrow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Eyebrow({
  children,
  tone = 'gold',
  rules = false,
  style,
  ...rest
}) {
  const color = tone === 'gold' ? 'var(--text-accent)' : tone === 'onNavy' ? 'var(--text-on-navy-muted)' : 'var(--text-muted)';
  const label = /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--eyebrow-size)',
      fontWeight: 'var(--eyebrow-weight)',
      letterSpacing: 'var(--eyebrow-tracking)',
      textTransform: 'uppercase',
      color,
      whiteSpace: 'nowrap'
    }
  }, children);
  if (!rules) return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      ...style
    }
  }, rest), label);
  const rule = /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 1,
      background: 'var(--rule-gold)',
      opacity: .7
    }
  });
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      ...style
    }
  }, rest), rule, label, rule);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/brand/GoldRule.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function GoldRule({
  width = '100%',
  thickness = 1,
  fade = false,
  style,
  ...rest
}) {
  const background = fade ? 'linear-gradient(90deg,rgba(212,175,55,0) 0%,var(--gold-500) 50%,rgba(212,175,55,0) 100%)' : 'var(--rule-gold)';
  return /*#__PURE__*/React.createElement("hr", _extends({
    style: {
      width,
      height: thickness,
      border: 0,
      margin: 0,
      background,
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { GoldRule });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/GoldRule.jsx", error: String((e && e.message) || e) }); }

// components/brand/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CDN = 'https://unpkg.com/lucide-static@0.544.0/icons/';

/* Lucide outline icons stand in for the brand kit's gold line icons (see readme
   ICONOGRAPHY). Rendered as a CSS mask so the glyph inherits currentColor. */
function Icon({
  name,
  size = 18,
  strokeColor = 'currentColor',
  style,
  ...rest
}) {
  const url = `url("${CDN}${name}.svg")`;
  return /*#__PURE__*/React.createElement("span", _extends({
    "aria-hidden": "true",
    style: {
      display: 'inline-block',
      width: size,
      height: size,
      flex: '0 0 auto',
      background: strokeColor,
      WebkitMaskImage: url,
      maskImage: url,
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Icon.jsx", error: String((e && e.message) || e) }); }

// components/brand/IconTile.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function IconTile({
  icon,
  size = 44,
  tone = 'goldOutline',
  shape = 'circle',
  children,
  style,
  ...rest
}) {
  const tones = {
    goldOutline: {
      background: 'transparent',
      border: '1px solid var(--gold-500)',
      color: 'var(--gold-500)'
    },
    goldSolid: {
      background: 'var(--gold-500)',
      border: '1px solid var(--gold-500)',
      color: 'var(--navy-800)'
    },
    goldSoft: {
      background: 'var(--surface-gold-soft)',
      border: '1px solid var(--gold-300)',
      color: 'var(--gold-700)'
    },
    navy: {
      background: 'var(--navy-800)',
      border: '1px solid var(--navy-700)',
      color: 'var(--gold-500)'
    },
    onNavy: {
      background: 'rgba(250,250,250,.06)',
      border: '1px solid var(--border-on-navy)',
      color: 'var(--gold-500)'
    }
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      borderRadius: shape === 'circle' ? 'var(--radius-pill)' : 'var(--radius-md)',
      flex: '0 0 auto',
      ...tones[tone],
      ...style
    }
  }, rest), children || /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: Math.round(size * 0.45)
  }));
}
Object.assign(__ds_scope, { IconTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/IconTile.jsx", error: String((e && e.message) || e) }); }

// components/brand/Logo.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const VARIANTS = {
  light: 'logo-light.png',
  dark: 'logo-dark.png',
  mono: 'logo-mono.png',
  primary: 'logo-primary-dark.png',
  mark: 'mark-dark.png',
  appicon: 'app-icon.png'
};
function Logo({
  variant = 'light',
  height = 48,
  assetBase = '../../assets',
  alt = 'CZ Digitizing',
  style,
  ...rest
}) {
  const src = assetBase + '/' + (VARIANTS[variant] || VARIANTS.light);
  return /*#__PURE__*/React.createElement("img", _extends({
    src: src,
    alt: alt,
    style: {
      height,
      width: 'auto',
      display: 'block',
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Logo.jsx", error: String((e && e.message) || e) }); }

// components/core/Accordion.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Accordion({
  items = [],
  defaultOpen = -1,
  style,
  ...rest
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'grid',
      gap: 'var(--space-2)',
      ...style
    }
  }, rest), items.map((it, i) => {
    const isOpen = open === i;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface-card)',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => setOpen(isOpen ? -1 : i),
      style: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        padding: '12px var(--space-4)',
        background: 'none',
        border: 0,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--weight-medium)',
        color: 'var(--text-strong)'
      }
    }, it.q, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--gold-600)',
        transform: isOpen ? 'rotate(180deg)' : 'none',
        transition: `transform var(--dur-normal) var(--ease-standard)`,
        display: 'inline-flex'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "chevron-down",
      size: 16
    }))), isOpen ? /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '0 var(--space-4) 14px',
        fontSize: 'var(--text-sm)',
        color: 'var(--text-muted)'
      }
    }, it.a) : null);
  }));
}
Object.assign(__ds_scope, { Accordion });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Accordion.jsx", error: String((e && e.message) || e) }); }

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Avatar({
  src,
  name = '',
  size = 36,
  shape = 'circle',
  ring = false,
  style,
  ...rest
}) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      flex: '0 0 auto',
      borderRadius: shape === 'circle' ? 'var(--radius-avatar)' : 'var(--radius-md)',
      overflow: 'hidden',
      background: 'var(--navy-700)',
      color: 'var(--gold-500)',
      fontFamily: 'var(--font-display)',
      fontSize: Math.round(size * 0.38),
      fontWeight: 'var(--weight-bold)',
      letterSpacing: '.02em',
      boxShadow: ring ? '0 0 0 2px var(--gold-500)' : 'none',
      ...style
    }
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  gold: {
    bg: 'var(--gold-500)',
    fg: 'var(--navy-800)'
  },
  goldSoft: {
    bg: 'var(--surface-gold-soft)',
    fg: 'var(--gold-700)'
  },
  navy: {
    bg: 'var(--navy-800)',
    fg: 'var(--cz-white)'
  },
  neutral: {
    bg: 'var(--gray-200)',
    fg: 'var(--text-muted)'
  },
  success: {
    bg: 'var(--status-paid-bg)',
    fg: 'var(--status-paid-fg)'
  },
  warning: {
    bg: 'var(--status-pending-bg)',
    fg: 'var(--status-pending-fg)'
  },
  danger: {
    bg: 'var(--status-failed-bg)',
    fg: 'var(--status-failed-fg)'
  },
  info: {
    bg: 'var(--status-progress-bg)',
    fg: 'var(--status-progress-fg)'
  }
};
function Badge({
  tone = 'neutral',
  icon,
  dot,
  size = 'md',
  children,
  style,
  ...rest
}) {
  const t = TONES[tone] || TONES.neutral;
  const s = size === 'sm' ? {
    fontSize: 'var(--text-2xs)',
    padding: '2px 8px'
  } : {
    fontSize: 'var(--text-xs)',
    padding: '4px 10px'
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      borderRadius: 'var(--radius-badge)',
      background: t.bg,
      color: t.fg,
      fontWeight: 'var(--weight-semibold)',
      lineHeight: 1.4,
      whiteSpace: 'nowrap',
      ...s,
      ...style
    }
  }, rest), dot ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'currentColor'
    }
  }) : null, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 12
  }) : null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: {
    height: 32,
    padding: '0 14px',
    fontSize: 'var(--text-xs)'
  },
  md: {
    height: 40,
    padding: '0 20px',
    fontSize: 'var(--text-sm)'
  },
  lg: {
    height: 48,
    padding: '0 28px',
    fontSize: 'var(--text-md)'
  }
};
function tone(variant, hover) {
  switch (variant) {
    case 'primary':
      return {
        background: hover ? 'var(--action-primary-hover)' : 'var(--action-primary)',
        color: 'var(--text-on-gold)',
        border: '1px solid transparent',
        boxShadow: hover ? 'var(--shadow-gold)' : 'var(--shadow-xs)'
      };
    case 'secondary':
      return {
        background: hover ? 'var(--action-secondary-hover)' : 'var(--action-secondary)',
        color: 'var(--text-on-navy)',
        border: '1px solid transparent',
        boxShadow: 'var(--shadow-xs)'
      };
    case 'outline':
      return {
        background: hover ? 'var(--gold-100)' : 'transparent',
        color: 'var(--gold-700)',
        border: '1px solid var(--gold-500)',
        boxShadow: 'none'
      };
    case 'outlineNavy':
      return {
        background: hover ? 'var(--gray-100)' : 'transparent',
        color: 'var(--text-strong)',
        border: '1px solid var(--border-strong)',
        boxShadow: 'none'
      };
    case 'onNavy':
      return {
        background: hover ? 'rgba(250,250,250,.12)' : 'rgba(250,250,250,.06)',
        color: 'var(--text-on-navy)',
        border: '1px solid var(--border-on-navy)',
        boxShadow: 'none'
      };
    case 'ghost':
      return {
        background: hover ? 'var(--gray-200)' : 'transparent',
        color: 'var(--text-body)',
        border: '1px solid transparent',
        boxShadow: 'none'
      };
    default:
      return {};
  }
}
function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconAfter,
  block,
  disabled,
  children,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [down, setDown] = React.useState(false);
  const t = tone(variant, hover && !disabled);
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setDown(false);
    },
    onMouseDown: () => setDown(true),
    onMouseUp: () => setDown(false),
    style: {
      display: block ? 'flex' : 'inline-flex',
      width: block ? '100%' : undefined,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--control-gap)',
      fontFamily: 'var(--font-body)',
      fontWeight: 'var(--weight-semibold)',
      letterSpacing: 'var(--tracking-wide)',
      borderRadius: 'var(--radius-button)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'var(--transition-control), transform var(--dur-instant) var(--ease-standard)',
      transform: down && !disabled ? 'translateY(1px)' : 'none',
      ...SIZES[size],
      ...t,
      ...(disabled ? {
        background: 'var(--action-disabled)',
        color: 'var(--text-faint)',
        border: '1px solid transparent',
        boxShadow: 'none'
      } : null),
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === 'lg' ? 18 : 15
  }) : null, children, iconAfter ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconAfter,
    size: size === 'lg' ? 18 : 15
  }) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Card({
  title,
  action,
  tone = 'light',
  padding = 'var(--card-pad)',
  bodyStyle,
  children,
  style,
  ...rest
}) {
  const tones = {
    light: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      color: 'var(--text-body)',
      boxShadow: 'var(--shadow-sm)'
    },
    navy: {
      background: 'var(--surface-navy)',
      border: '1px solid var(--border-on-navy)',
      color: 'var(--text-on-navy)',
      boxShadow: 'var(--shadow-navy)'
    },
    gold: {
      background: 'var(--surface-gold-soft)',
      border: '1px solid var(--gold-300)',
      color: 'var(--gold-700)',
      boxShadow: 'none'
    },
    flat: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      color: 'var(--text-body)',
      boxShadow: 'none'
    }
  };
  const t = tones[tone] || tones.light;
  return /*#__PURE__*/React.createElement("section", _extends({
    style: {
      borderRadius: 'var(--radius-card)',
      overflow: 'hidden',
      ...t,
      ...style
    }
  }, rest), title || action ? /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-3)',
      padding: `var(--space-4) ${padding} 0`
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      fontSize: 'var(--text-h4)',
      color: tone === 'navy' ? 'var(--text-on-navy)' : 'var(--text-strong)'
    }
  }, title), action) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding,
      ...bodyStyle
    }
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function IconButton({
  icon,
  label,
  size = 36,
  variant = 'ghost',
  badge,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const tones = {
    ghost: {
      background: hover ? 'var(--gray-200)' : 'transparent',
      color: 'var(--text-body)',
      border: '1px solid transparent'
    },
    outline: {
      background: hover ? 'var(--gray-100)' : 'var(--surface-card)',
      color: 'var(--text-body)',
      border: '1px solid var(--border-subtle)'
    },
    gold: {
      background: hover ? 'var(--action-primary-hover)' : 'var(--action-primary)',
      color: 'var(--text-on-gold)',
      border: '1px solid transparent'
    },
    onNavy: {
      background: hover ? 'rgba(250,250,250,.12)' : 'transparent',
      color: 'var(--text-on-navy)',
      border: '1px solid transparent'
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    "aria-label": label,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      transition: 'var(--transition-control)',
      ...tones[variant],
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: Math.round(size * 0.5)
  }), badge ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 4,
      right: 4,
      minWidth: 15,
      height: 15,
      padding: '0 3px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--red-600)',
      color: '#fff',
      fontSize: 9,
      fontWeight: 'var(--weight-bold)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, badge) : null);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Pagination.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Pagination({
  page = 1,
  pages = 1,
  onChange,
  summary,
  style,
  ...rest
}) {
  const nums = [];
  for (let i = 1; i <= Math.min(pages, 4); i++) nums.push(i);
  const btn = (content, key, opts = {}) => /*#__PURE__*/React.createElement("button", {
    key: key,
    disabled: opts.disabled,
    onClick: () => opts.to && onChange && onChange(opts.to),
    style: {
      minWidth: 28,
      height: 28,
      padding: '0 6px',
      borderRadius: 'var(--radius-sm)',
      cursor: opts.disabled ? 'default' : 'pointer',
      border: '1px solid ' + (opts.active ? 'var(--gold-500)' : 'var(--border-subtle)'),
      background: opts.active ? 'var(--gold-500)' : 'var(--surface-card)',
      color: opts.active ? 'var(--navy-800)' : opts.disabled ? 'var(--text-faint)' : 'var(--text-body)',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-semibold)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'var(--transition-control)'
    }
  }, content);
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-4)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, summary), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, btn(/*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-left",
    size: 13
  }), 'prev', {
    disabled: page === 1,
    to: page - 1
  }), nums.map(n => btn(n, n, {
    active: n === page,
    to: n
  })), pages > 4 ? /*#__PURE__*/React.createElement("span", {
    key: "e",
    style: {
      alignSelf: 'center',
      color: 'var(--text-faint)',
      fontSize: 'var(--text-xs)'
    }
  }, "\u2026") : null, btn(/*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-right",
    size: 13
  }), 'next', {
    disabled: page === pages,
    to: page + 1
  })));
}
Object.assign(__ds_scope, { Pagination });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Pagination.jsx", error: String((e && e.message) || e) }); }

// components/core/SegmentedToggle.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SegmentedToggle({
  options = [],
  value,
  onChange,
  size = 'md',
  tone = 'light',
  style,
  ...rest
}) {
  const s = size === 'sm' ? {
    h: 26,
    fs: 'var(--text-2xs)',
    px: 10
  } : {
    h: 34,
    fs: 'var(--text-xs)',
    px: 16
  };
  const onNavy = tone === 'navy';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'inline-flex',
      gap: 2,
      padding: 3,
      borderRadius: 'var(--radius-pill)',
      background: onNavy ? 'rgba(250,250,250,.07)' : 'var(--surface-sunken)',
      ...style
    }
  }, rest), options.map(o => {
    const key = typeof o === 'string' ? o : o.value;
    const label = typeof o === 'string' ? o : o.label;
    const active = key === value;
    return /*#__PURE__*/React.createElement("button", {
      key: key,
      onClick: () => onChange && onChange(key),
      style: {
        height: s.h,
        padding: `0 ${s.px}px`,
        borderRadius: 'var(--radius-pill)',
        border: 0,
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        fontSize: s.fs,
        fontWeight: 'var(--weight-semibold)',
        letterSpacing: 'var(--tracking-wide)',
        background: active ? 'var(--gold-500)' : 'transparent',
        color: active ? 'var(--navy-800)' : onNavy ? 'var(--text-on-navy-muted)' : 'var(--text-muted)',
        transition: 'var(--transition-control)',
        whiteSpace: 'nowrap'
      }
    }, label);
  }));
}
Object.assign(__ds_scope, { SegmentedToggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SegmentedToggle.jsx", error: String((e && e.message) || e) }); }

// components/core/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Tabs({
  tabs = [],
  value,
  onChange,
  tone = 'light',
  style,
  ...rest
}) {
  const onNavy = tone === 'navy';
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    style: {
      display: 'flex',
      gap: 'var(--space-5)',
      borderBottom: `1px solid ${onNavy ? 'var(--border-on-navy)' : 'var(--border-subtle)'}`,
      ...style
    }
  }, rest), tabs.map(t => {
    const key = typeof t === 'string' ? t : t.value;
    const label = typeof t === 'string' ? t : t.label;
    const active = key === value;
    return /*#__PURE__*/React.createElement("button", {
      key: key,
      role: "tab",
      "aria-selected": active,
      onClick: () => onChange && onChange(key),
      style: {
        background: 'none',
        border: 0,
        padding: '10px 0 11px',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-sm)',
        fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-medium)',
        color: active ? onNavy ? 'var(--gold-500)' : 'var(--text-strong)' : onNavy ? 'var(--text-on-navy-muted)' : 'var(--text-muted)',
        boxShadow: active ? 'inset 0 -2px 0 var(--gold-500)' : 'none',
        transition: 'var(--transition-control)',
        whiteSpace: 'nowrap'
      }
    }, label);
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/data/ActivityRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TINTS = {
  green: {
    bg: 'var(--green-100)',
    fg: 'var(--green-600)'
  },
  blue: {
    bg: 'var(--blue-100)',
    fg: 'var(--blue-600)'
  },
  gold: {
    bg: 'var(--surface-gold-soft)',
    fg: 'var(--gold-700)'
  },
  red: {
    bg: 'var(--red-100)',
    fg: 'var(--red-600)'
  },
  violet: {
    bg: 'var(--violet-100)',
    fg: 'var(--violet-600)'
  },
  neutral: {
    bg: 'var(--gray-200)',
    fg: 'var(--text-muted)'
  }
};
function ActivityRow({
  icon = 'activity',
  tint = 'neutral',
  title,
  meta,
  time,
  divider = true,
  style,
  ...rest
}) {
  const t = TINTS[tint] || TINTS.neutral;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-3)',
      padding: '10px 0',
      borderBottom: divider ? '1px solid var(--border-subtle)' : 'none',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 28,
      height: 28,
      borderRadius: 'var(--radius-pill)',
      background: t.bg,
      color: t.fg,
      flex: '0 0 auto'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 14
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--text-strong)'
    }
  }, title), meta ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      marginTop: 1
    }
  }, meta) : null), time ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-2xs)',
      color: 'var(--text-faint)',
      whiteSpace: 'nowrap'
    }
  }, time) : null);
}
Object.assign(__ds_scope, { ActivityRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ActivityRow.jsx", error: String((e && e.message) || e) }); }

// components/data/BarChart.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function BarChart({
  data = [],
  height = 140,
  color = 'var(--gold-500)',
  style,
  ...rest
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 6,
      height,
      ...style
    }
  }, rest), data.map(d => /*#__PURE__*/React.createElement("div", {
    key: d.label,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      height: '100%',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: 26,
      height: `${d.value / max * 100}%`,
      background: color,
      borderRadius: '3px 3px 0 0'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-2xs)',
      color: 'var(--text-faint)'
    }
  }, d.label))));
}
Object.assign(__ds_scope, { BarChart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/BarChart.jsx", error: String((e && e.message) || e) }); }

// components/data/DataTable.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function DataTable({
  columns = [],
  rows = [],
  dense = false,
  style,
  ...rest
}) {
  const pad = dense ? '8px 12px' : '11px 14px';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      overflowX: 'auto',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map((c, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      textAlign: c.align || 'left',
      padding: pad,
      whiteSpace: 'nowrap',
      fontSize: 'var(--text-2xs)',
      fontWeight: 'var(--weight-semibold)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      background: 'var(--surface-sunken)',
      borderBottom: '1px solid var(--border-subtle)',
      width: c.width
    }
  }, c.header)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, ri) => /*#__PURE__*/React.createElement("tr", {
    key: ri,
    style: {
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, columns.map((c, ci) => /*#__PURE__*/React.createElement("td", {
    key: ci,
    style: {
      textAlign: c.align || 'left',
      padding: pad,
      fontSize: 'var(--text-sm)',
      color: ci === 0 ? 'var(--text-muted)' : 'var(--text-body)',
      fontWeight: c.strong ? 'var(--weight-semibold)' : 'var(--weight-regular)',
      whiteSpace: c.wrap ? 'normal' : 'nowrap'
    }
  }, typeof c.cell === 'function' ? c.cell(r, ri) : r[c.key])))))));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/data/DonutStat.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function DonutStat({
  segments = [],
  size = 120,
  thickness = 18,
  style,
  ...rest
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const stops = segments.map(s => {
    const from = acc / total * 100;
    acc += s.value;
    return `${s.color} ${from}% ${acc / total * 100}%`;
  }).join(',');
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-5)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      flex: '0 0 auto',
      background: `conic-gradient(${stops})`,
      WebkitMask: `radial-gradient(circle, transparent ${size / 2 - thickness}px, #000 ${size / 2 - thickness + 1}px)`,
      mask: `radial-gradient(circle, transparent ${size / 2 - thickness}px, #000 ${size / 2 - thickness + 1}px)`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 6,
      minWidth: 0
    }
  }, segments.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.label,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 'var(--text-xs)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: s.color,
      flex: '0 0 auto'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-body)',
      flex: 1
    }
  }, s.label), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-strong)',
      fontWeight: 'var(--weight-semibold)'
    }
  }, Math.round(s.value / total * 100), "%")))));
}
Object.assign(__ds_scope, { DonutStat });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DonutStat.jsx", error: String((e && e.message) || e) }); }

// components/data/LineChart.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function LineChart({
  data = [],
  height = 240,
  color = 'var(--gold-500)',
  valueFormat,
  gridLines = 4,
  style,
  ...rest
}) {
  const vals = data.map(d => d.value);
  const max = Math.max(...vals, 1);
  const min = 0;
  const W = 1000,
    H = 300,
    padL = 8,
    padR = 8,
    padT = 14,
    padB = 8;
  const x = i => padL + i / Math.max(data.length - 1, 1) * (W - padL - padR);
  const y = v => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const pts = data.map((d, i) => [x(i), y(d.value)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ` L ${pts[pts.length - 1][0].toFixed(1)} ${H - padB} L ${pts[0][0].toFixed(1)} ${H - padB} Z`;
  const ticks = Array.from({
    length: gridLines + 1
  }, (_, i) => min + (max - min) * (i / gridLines));
  const fmt = valueFormat || (v => Math.round(v));
  const gid = React.useId ? React.useId().replace(/:/g, '') : 'lcg';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      height,
      paddingTop: 4,
      paddingBottom: 22,
      flex: '0 0 auto'
    }
  }, ticks.slice().reverse().map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontSize: 'var(--text-2xs)',
      color: 'var(--text-faint)',
      lineHeight: 1,
      whiteSpace: 'nowrap'
    }
  }, fmt(t)))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: "none",
    style: {
      display: 'block',
      width: '100%',
      height: height - 22,
      overflow: 'visible'
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: gid,
    x1: "0",
    y1: "0",
    x2: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0%",
    stopColor: color,
    stopOpacity: ".18"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "100%",
    stopColor: color,
    stopOpacity: "0"
  }))), ticks.map((t, i) => /*#__PURE__*/React.createElement("line", {
    key: i,
    x1: padL,
    x2: W - padR,
    y1: y(t),
    y2: y(t),
    stroke: "var(--border-subtle)",
    strokeWidth: "1",
    vectorEffect: "non-scaling-stroke"
  })), /*#__PURE__*/React.createElement("path", {
    d: area,
    fill: `url(#${gid})`
  }), /*#__PURE__*/React.createElement("path", {
    d: line,
    fill: "none",
    stroke: color,
    strokeWidth: "2.5",
    strokeLinejoin: "round",
    strokeLinecap: "round",
    vectorEffect: "non-scaling-stroke"
  }), pts.map((p, i) => /*#__PURE__*/React.createElement("circle", {
    key: i,
    cx: p[0],
    cy: p[1],
    r: "4",
    fill: "var(--surface-card)",
    stroke: color,
    strokeWidth: "2.5",
    vectorEffect: "non-scaling-stroke"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 8
    }
  }, data.map(d => /*#__PURE__*/React.createElement("span", {
    key: d.label,
    style: {
      fontSize: 'var(--text-2xs)',
      color: 'var(--text-faint)'
    }
  }, d.label))))));
}
Object.assign(__ds_scope, { LineChart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/LineChart.jsx", error: String((e && e.message) || e) }); }

// components/data/StatCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TINTS = {
  green: {
    bg: 'var(--green-100)',
    fg: 'var(--green-600)'
  },
  blue: {
    bg: 'var(--blue-100)',
    fg: 'var(--blue-600)'
  },
  gold: {
    bg: 'var(--surface-gold-soft)',
    fg: 'var(--gold-700)'
  },
  red: {
    bg: 'var(--red-100)',
    fg: 'var(--red-600)'
  },
  violet: {
    bg: 'var(--violet-100)',
    fg: 'var(--violet-600)'
  },
  navy: {
    bg: 'var(--gray-200)',
    fg: 'var(--navy-800)'
  }
};
function StatCard({
  label,
  value,
  delta,
  deltaTone = 'up',
  icon,
  tint = 'gold',
  note,
  style,
  ...rest
}) {
  const t = TINTS[tint] || TINTS.gold;
  const deltaColor = deltaTone === 'up' ? 'var(--green-600)' : deltaTone === 'down' ? 'var(--red-600)' : 'var(--amber-600)';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-3)',
      padding: 'var(--card-pad-sm)',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-sm)',
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 34,
      height: 34,
      borderRadius: 'var(--radius-md)',
      background: t.bg,
      color: t.fg,
      flex: '0 0 auto'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 17
  })) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xs)',
      fontWeight: 'var(--weight-semibold)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 26,
      fontWeight: 'var(--weight-bold)',
      color: 'var(--text-strong)',
      lineHeight: 1.15,
      marginTop: 2
    }
  }, value), delta ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xs)',
      fontWeight: 'var(--weight-semibold)',
      color: deltaColor,
      marginTop: 2
    }
  }, delta) : null, note ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xs)',
      color: 'var(--text-faint)',
      marginTop: 2
    }
  }, note) : null));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Checkbox({
  checked,
  onChange,
  label,
  tone = 'light',
  disabled,
  style,
  ...rest
}) {
  const onNavy = tone === 'navy';
  return /*#__PURE__*/React.createElement("label", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .5 : 1,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      width: 18,
      height: 18,
      flex: '0 0 auto',
      borderRadius: 'var(--radius-xs)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: checked ? 'var(--gold-500)' : 'transparent',
      border: '1px solid ' + (checked ? 'var(--gold-500)' : onNavy ? 'rgba(250,250,250,.3)' : 'var(--border-strong)'),
      color: 'var(--navy-800)',
      transition: 'var(--transition-control)'
    }
  }, checked ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 13
  }) : null), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: onNavy ? 'var(--text-on-navy)' : 'var(--text-body)'
    }
  }, label) : null);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/FileField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function FileField({
  buttonLabel = 'Choose File',
  fileName = 'No file chosen',
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      cursor: 'pointer',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 'var(--field-h-sm)',
      padding: '0 12px',
      borderRadius: 'var(--radius-field)',
      border: '1px solid var(--border-strong)',
      background: hover ? 'var(--gray-100)' : 'var(--surface-card)',
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--text-strong)',
      transition: 'var(--transition-control)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "upload",
    size: 13
  }), buttonLabel), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-faint)'
    }
  }, fileName), /*#__PURE__*/React.createElement("input", {
    type: "file",
    style: {
      display: 'none'
    }
  }));
}
Object.assign(__ds_scope, { FileField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/FileField.jsx", error: String((e && e.message) || e) }); }

// components/forms/FormField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function FormField({
  label,
  required,
  hint,
  error,
  htmlFor,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'grid',
      gap: 6,
      ...style
    }
  }, rest), label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: htmlFor,
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--text-strong)'
    }
  }, label, required ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--gold-600)'
    }
  }, " *") : null) : null, children, error ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-2xs)',
      color: 'var(--red-600)'
    }
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-2xs)',
      color: 'var(--text-faint)'
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { FormField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/FormField.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  icon,
  size = 'md',
  invalid,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const h = size === 'sm' ? 'var(--field-h-sm)' : 'var(--field-h)';
  const field = /*#__PURE__*/React.createElement("input", _extends({
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      height: h,
      padding: icon ? '0 12px 0 34px' : '0 12px',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-strong)',
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-field)',
      border: '1px solid ' + (invalid ? 'var(--red-600)' : focus ? 'var(--gold-500)' : 'var(--border-subtle)'),
      boxShadow: focus ? 'var(--ring-focus)' : 'none',
      outline: 'none',
      transition: 'var(--transition-control)',
      ...style
    }
  }, rest));
  if (!icon) return field;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 11,
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--text-faint)',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 15
  })), field);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Radio({
  checked,
  onChange,
  label,
  disabled,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .5 : 1,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(true),
    style: {
      width: 18,
      height: 18,
      flex: '0 0 auto',
      borderRadius: '50%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid ' + (checked ? 'var(--gold-500)' : 'var(--border-strong)'),
      transition: 'var(--transition-control)'
    }
  }, checked ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: 'var(--gold-500)'
    }
  }) : null), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-body)'
    }
  }, label) : null);
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/SearchField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SearchField({
  placeholder = 'Search…',
  width = 320,
  size = 'md',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Input, _extends({
    icon: "search",
    placeholder: placeholder,
    size: size
  }, rest)));
}
Object.assign(__ds_scope, { SearchField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SearchField.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Select({
  options = [],
  size = 'md',
  placeholder,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'block'
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      height: size === 'sm' ? 'var(--field-h-sm)' : 'var(--field-h)',
      padding: '0 32px 0 12px',
      appearance: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-strong)',
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-field)',
      border: '1px solid ' + (focus ? 'var(--gold-500)' : 'var(--border-subtle)'),
      boxShadow: focus ? 'var(--ring-focus)' : 'none',
      outline: 'none',
      transition: 'var(--transition-control)',
      ...style
    }
  }, rest), placeholder ? /*#__PURE__*/React.createElement("option", {
    value: ""
  }, placeholder) : null, options.map(o => {
    const v = typeof o === 'string' ? o : o.value;
    const l = typeof o === 'string' ? o : o.label;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 11,
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--text-muted)',
      pointerEvents: 'none',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 15
  })));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Textarea({
  rows = 4,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("textarea", _extends({
    rows: rows,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      padding: '10px 12px',
      resize: 'vertical',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--lh-sm)',
      color: 'var(--text-strong)',
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-field)',
      border: '1px solid ' + (focus ? 'var(--gold-500)' : 'var(--border-subtle)'),
      boxShadow: focus ? 'var(--ring-focus)' : 'none',
      outline: 'none',
      transition: 'var(--transition-control)',
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/marketing/CreditPack.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function CreditPack({
  credits,
  label,
  price,
  unit,
  featured,
  flag = 'Best Value',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: 'relative',
      textAlign: 'center',
      padding: '18px 12px 16px',
      borderRadius: 'var(--radius-md)',
      background: featured ? 'var(--surface-gold-soft)' : 'var(--surface-card)',
      border: '1px solid ' + (featured ? 'var(--gold-500)' : 'var(--border-subtle)'),
      boxShadow: featured ? 'var(--shadow-md)' : 'none',
      ...style
    }
  }, rest), featured ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -10,
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '2px 10px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--gold-500)',
      color: 'var(--navy-800)',
      fontSize: 9,
      fontWeight: 'var(--weight-bold)',
      letterSpacing: 'var(--tracking-wide)',
      whiteSpace: 'nowrap'
    }
  }, flag) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 28,
      fontWeight: 'var(--weight-bold)',
      color: 'var(--text-strong)',
      lineHeight: 1
    }
  }, credits), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xs)',
      color: 'var(--text-muted)',
      marginTop: 3
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-md)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--gold-700)',
      marginTop: 8
    }
  }, price), unit ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: 'var(--text-faint)',
      marginTop: 2
    }
  }, unit) : null);
}
Object.assign(__ds_scope, { CreditPack });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/CreditPack.jsx", error: String((e && e.message) || e) }); }

// components/marketing/FeatureItem.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function FeatureItem({
  icon,
  title,
  sub,
  tone = 'onNavy',
  style,
  ...rest
}) {
  const onNavy = tone === 'onNavy';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.IconTile, {
    icon: icon,
    size: 34,
    tone: onNavy ? 'onNavy' : 'goldOutline'
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      lineHeight: 1.25
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-semibold)',
      color: onNavy ? 'var(--text-on-navy)' : 'var(--text-strong)'
    }
  }, title), sub ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xs)',
      color: onNavy ? 'var(--text-on-navy-muted)' : 'var(--text-muted)'
    }
  }, sub) : null));
}
Object.assign(__ds_scope, { FeatureItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/FeatureItem.jsx", error: String((e && e.message) || e) }); }

// components/marketing/FlagChip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function toEmoji(code) {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(...code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}
function FlagChip({
  flag,
  label,
  size = 20,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      fontSize: size,
      lineHeight: 1
    }
  }, toEmoji(flag)), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-2xs)',
      color: 'var(--text-muted)'
    }
  }, label) : null);
}
Object.assign(__ds_scope, { FlagChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/FlagChip.jsx", error: String((e && e.message) || e) }); }

// components/marketing/PricingCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function PricingCard({
  name,
  price,
  period = '/ month',
  blurb,
  features = [],
  featured,
  ribbon = 'Most Popular',
  ctaLabel = 'Choose Plan',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: 'relative',
      padding: 'var(--space-5)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--surface-card)',
      border: '1px solid ' + (featured ? 'var(--gold-500)' : 'var(--border-subtle)'),
      boxShadow: featured ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
      ...style
    }
  }, rest), featured ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -11,
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '3px 12px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--gold-500)',
      color: 'var(--navy-800)',
      fontSize: 'var(--text-2xs)',
      fontWeight: 'var(--weight-bold)',
      letterSpacing: 'var(--tracking-wide)',
      whiteSpace: 'nowrap'
    }
  }, ribbon) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-h4)',
      fontWeight: 'var(--weight-bold)',
      color: 'var(--text-strong)'
    }
  }, name), blurb ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      marginTop: 3
    }
  }, blurb) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 5,
      margin: '14px 0 16px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 38,
      fontWeight: 'var(--weight-bold)',
      color: featured ? 'var(--gold-600)' : 'var(--text-strong)',
      lineHeight: 1
    }
  }, price), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, period)), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: '0 0 18px',
      padding: 0,
      display: 'grid',
      gap: 8
    }
  }, features.map((ft, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      fontSize: 'var(--text-xs)',
      color: 'var(--text-body)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--green-600)',
      display: 'inline-flex',
      marginTop: 1
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 13
  })), ft))), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: featured ? 'primary' : 'outlineNavy',
    block: true
  }, ctaLabel));
}
Object.assign(__ds_scope, { PricingCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/PricingCard.jsx", error: String((e && e.message) || e) }); }

// components/marketing/ServiceCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function ServiceCard({
  image,
  title,
  description,
  linkLabel = 'View Service',
  tone = 'light',
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const onNavy = tone === 'navy';
  return /*#__PURE__*/React.createElement("a", _extends({
    href: "#",
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'block',
      textDecoration: 'none',
      borderRadius: 'var(--radius-card)',
      overflow: 'hidden',
      background: onNavy ? 'var(--surface-navy-raised)' : 'var(--surface-card)',
      border: '1px solid ' + (hover ? 'var(--gold-500)' : onNavy ? 'var(--border-on-navy)' : 'var(--border-subtle)'),
      boxShadow: hover ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      transform: hover ? 'translateY(-2px)' : 'none',
      transition: 'var(--transition-control), transform var(--dur-normal) var(--ease-out)',
      ...style
    }
  }, rest), image ? /*#__PURE__*/React.createElement("img", {
    src: image,
    alt: "",
    style: {
      display: 'block',
      width: '100%',
      height: 118,
      objectFit: 'cover'
    }
  }) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'var(--card-pad-sm)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-md)',
      fontWeight: 'var(--weight-bold)',
      color: onNavy ? 'var(--text-on-navy)' : 'var(--text-strong)'
    }
  }, title), description ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: onNavy ? 'var(--text-on-navy-muted)' : 'var(--text-muted)',
      marginTop: 4,
      lineHeight: 1.5
    }
  }, description) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      marginTop: 10,
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--gold-600)'
    }
  }, linkLabel, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "arrow-right",
    size: 13
  }))));
}
Object.assign(__ds_scope, { ServiceCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/ServiceCard.jsx", error: String((e && e.message) || e) }); }

// components/marketing/TestimonialCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function TestimonialCard({
  quote,
  name,
  country,
  flag,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("figure", _extends({
    style: {
      margin: 0,
      padding: 'var(--card-pad-sm)',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-xs)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("blockquote", {
    style: {
      margin: 0,
      fontSize: 'var(--text-xs)',
      lineHeight: 1.6,
      color: 'var(--text-body)'
    }
  }, "\u201C", quote, "\u201D"), /*#__PURE__*/React.createElement("figcaption", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      paddingTop: 10,
      borderTop: '1px solid var(--border-subtle)'
    }
  }, flag ? /*#__PURE__*/React.createElement(__ds_scope.FlagChip, {
    flag: flag
  }) : null, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 'var(--text-xs)',
      fontWeight: 'var(--weight-semibold)',
      color: 'var(--text-strong)'
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 'var(--text-2xs)',
      color: 'var(--text-faint)'
    }
  }, country))));
}
Object.assign(__ds_scope, { TestimonialCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/TestimonialCard.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SidebarNav.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SidebarNav({
  items = [],
  value,
  onChange,
  footer,
  header,
  width = 'var(--sidebar-w)',
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("nav", _extends({
    style: {
      width,
      flex: '0 0 auto',
      background: 'var(--surface-navy)',
      color: 'var(--text-on-navy)',
      display: 'flex',
      flexDirection: 'column',
      ...style
    }
  }, rest), header, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 2,
      padding: 'var(--space-4) var(--space-3)',
      flex: 1,
      alignContent: 'start'
    }
  }, items.map((it, i) => {
    if (it.section) return /*#__PURE__*/React.createElement("div", {
      key: 's' + i,
      style: {
        padding: i === 0 ? '0 11px 8px' : '18px 11px 8px',
        fontSize: 9,
        fontWeight: 'var(--weight-semibold)',
        letterSpacing: 'var(--tracking-widest)',
        textTransform: 'uppercase',
        color: 'rgba(250,250,250,.34)'
      }
    }, it.section);
    const active = it.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: it.value,
      onClick: () => onChange && onChange(it.value),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 11px',
        borderRadius: 'var(--radius-sm)',
        border: 0,
        cursor: 'pointer',
        textAlign: 'left',
        background: active ? 'var(--gold-500)' : 'transparent',
        color: active ? 'var(--navy-800)' : 'var(--text-on-navy-muted)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-xs)',
        fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-medium)',
        transition: 'var(--transition-control)'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: 15
    }), it.label);
  })), footer);
}
Object.assign(__ds_scope, { SidebarNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SidebarNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SiteHeader.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function SiteHeader({
  links = [],
  active,
  onNavigate,
  assetBase = '../../assets',
  right,
  cartCount,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("header", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-6)',
      padding: '0 var(--space-6)',
      height: 60,
      background: 'var(--surface-navy)',
      borderBottom: '1px solid var(--border-on-navy)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Logo, {
    variant: "dark",
    height: 34,
    assetBase: assetBase
  }), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-5)',
      marginLeft: 'auto'
    }
  }, links.map(l => {
    const key = typeof l === 'string' ? l : l.value;
    const label = typeof l === 'string' ? l : l.label;
    const isActive = key === active;
    return /*#__PURE__*/React.createElement("button", {
      key: key,
      onClick: () => onNavigate && onNavigate(key),
      style: {
        background: 'none',
        border: 0,
        padding: '4px 0',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-xs)',
        fontWeight: isActive ? 'var(--weight-semibold)' : 'var(--weight-medium)',
        letterSpacing: 'var(--tracking-wide)',
        color: isActive ? 'var(--gold-500)' : 'var(--text-on-navy)',
        boxShadow: isActive ? 'inset 0 -2px 0 var(--gold-500)' : 'none',
        transition: 'var(--transition-control)',
        whiteSpace: 'nowrap'
      }
    }, label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      color: 'var(--text-on-navy)'
    }
  }, typeof cartCount === 'number' ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "shopping-cart",
    size: 17
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -6,
      right: -8,
      minWidth: 15,
      height: 15,
      borderRadius: 'var(--radius-pill)',
      background: 'var(--gold-500)',
      color: 'var(--navy-800)',
      fontSize: 9,
      fontWeight: 'var(--weight-bold)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, cartCount)) : null, right));
}
Object.assign(__ds_scope, { SiteHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SiteHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function TopBar({
  title,
  subtitle,
  right,
  tone = 'light',
  style,
  ...rest
}) {
  const onNavy = tone === 'navy';
  return /*#__PURE__*/React.createElement("header", _extends({
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 'var(--space-4)',
      minHeight: 'var(--topbar-h)',
      padding: '0 var(--space-6)',
      background: onNavy ? 'var(--surface-navy)' : 'var(--surface-card)',
      borderBottom: '1px solid ' + (onNavy ? 'var(--border-on-navy)' : 'var(--border-subtle)'),
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-h3)',
      color: onNavy ? 'var(--text-on-navy)' : 'var(--text-strong)'
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: onNavy ? 'var(--text-on-navy-muted)' : 'var(--text-muted)',
      marginTop: 1
    }
  }, subtitle) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)'
    }
  }, right));
}
Object.assign(__ds_scope, { TopBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin_panel/ActivityView.jsx
try { (() => {
const {
  Card,
  ActivityRow,
  Tabs,
  Select,
  SearchField,
  Button,
  DataTable,
  Badge
} = window.CZDigitizingDesignSystem_765273;
function ActivityView() {
  const [tab, setTab] = React.useState('All');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(ViewHeader, {
    title: "Activity Logs",
    subtitle: "All users \xB7 all actions",
    right: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      placeholder: "All Users",
      options: ['All Users', 'Super Admin', 'Admin', 'Customer'],
      style: {
        width: 120
      }
    }), /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      placeholder: "All Actions",
      options: ['All Actions', 'Uploads', 'Downloads', 'Payments'],
      style: {
        width: 120
      }
    }), /*#__PURE__*/React.createElement(SearchField, {
      placeholder: "Search logs\u2026",
      width: 190,
      size: "sm"
    }), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary",
      icon: "download"
    }, "Export"))
  }), /*#__PURE__*/React.createElement("div", {
    style: BODY
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1.4fr',
      gap: 18,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Notifications",
    action: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost"
    }, "Mark all as read")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    tabs: ['All', 'Orders', 'Quotes', 'Users', 'System'],
    value: tab,
    onChange: setTab
  })), ACTIVITY.map((a, i) => /*#__PURE__*/React.createElement(ActivityRow, {
    key: i,
    icon: a.icon,
    tint: a.tint,
    title: a.title,
    meta: a.meta,
    time: a.time,
    divider: i < ACTIVITY.length - 1
  }))), /*#__PURE__*/React.createElement(Card, {
    title: "Audit Trail",
    padding: "0"
  }, /*#__PURE__*/React.createElement(DataTable, {
    dense: true,
    rows: ACTIVITY,
    columns: [{
      header: '#',
      width: 36,
      cell: (r, i) => i + 1
    }, {
      header: 'User',
      cell: r => /*#__PURE__*/React.createElement("span", {
        style: {
          fontWeight: 600,
          color: 'var(--text-strong)'
        }
      }, r.user)
    }, {
      header: 'Action',
      cell: r => /*#__PURE__*/React.createElement(Badge, {
        tone: "neutral",
        size: "sm"
      }, r.title)
    }, {
      header: 'Details',
      key: 'meta',
      wrap: true
    }, {
      header: 'Date & Time',
      key: 'time'
    }, {
      header: 'IP Address',
      key: 'ip'
    }]
  })))));
}
Object.assign(window, {
  ActivityView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin_panel/ActivityView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin_panel/AdminData.jsx
try { (() => {
const CUSTOMERS = [{
  i: 1,
  name: 'Ahmed Khan',
  email: 'ahmed@gmail.com',
  wa: '+92 300 1234567',
  country: 'Pakistan',
  flag: 'PK',
  orders: 5,
  spent: '$245.00',
  status: 'Active'
}, {
  i: 2,
  name: 'Sara Ahmed',
  email: 'sara@gmail.com',
  wa: '+92 321 9876543',
  country: 'UAE',
  flag: 'AE',
  orders: 3,
  spent: '$180.00',
  status: 'Active'
}, {
  i: 3,
  name: 'Ali Raza',
  email: 'ali@gmail.com',
  wa: '+92 333 4567890',
  country: 'UK',
  flag: 'GB',
  orders: 7,
  spent: '$430.00',
  status: 'Active'
}, {
  i: 4,
  name: 'Fatima Noor',
  email: 'fatima@gmail.com',
  wa: '+92 345 1122334',
  country: 'Canada',
  flag: 'CA',
  orders: 2,
  spent: '$120.00',
  status: 'Active'
}, {
  i: 5,
  name: 'John Smith',
  email: 'john@gmail.com',
  wa: '+1 415 5551234',
  country: 'USA',
  flag: 'US',
  orders: 4,
  spent: '$310.00',
  status: 'Active'
}, {
  i: 6,
  name: 'Ayesha Malik',
  email: 'ayesha@gmail.com',
  wa: '+92 322 6677889',
  country: 'Pakistan',
  flag: 'PK',
  orders: 1,
  spent: '$70.00',
  status: 'Inactive'
}, {
  i: 7,
  name: 'Michael Brown',
  email: 'michael@gmail.com',
  wa: '+1 917 8880999',
  country: 'Australia',
  flag: 'AU',
  orders: 6,
  spent: '$260.00',
  status: 'Active'
}, {
  i: 8,
  name: 'Liu Wang',
  email: 'liu@gmail.com',
  wa: '+86 138 12345678',
  country: 'China',
  flag: 'CN',
  orders: 3,
  spent: '$150.00',
  status: 'Active'
}];
const ORDERS = [{
  i: 1,
  id: 'CZ-10025',
  cust: 'Ahmed Khan',
  date: '15 Aug 2026',
  amt: '$45.00',
  pay: 'Paid',
  payTone: 'success',
  status: 'Completed',
  statusTone: 'success'
}, {
  i: 2,
  id: 'CZ-10024',
  cust: 'Sara Ahmed',
  date: '14 Aug 2026',
  amt: '$68.00',
  pay: 'Processing',
  payTone: 'info',
  status: 'In Progress',
  statusTone: 'info'
}, {
  i: 3,
  id: 'CZ-10023',
  cust: 'Ali Raza',
  date: '14 Aug 2026',
  amt: '$120.00',
  pay: 'Paid',
  payTone: 'success',
  status: 'Completed',
  statusTone: 'success'
}, {
  i: 4,
  id: 'CZ-10022',
  cust: 'Fatima Noor',
  date: '12 Aug 2026',
  amt: '$35.00',
  pay: 'Paid',
  payTone: 'success',
  status: 'Delivered',
  statusTone: 'success'
}, {
  i: 5,
  id: 'CZ-10021',
  cust: 'John Smith',
  date: '11 Aug 2026',
  amt: '$90.00',
  pay: 'Under Review',
  payTone: 'warning',
  status: 'Pending',
  statusTone: 'warning'
}, {
  i: 6,
  id: 'CZ-10020',
  cust: 'Ayesha Malik',
  date: '10 Aug 2026',
  amt: '$70.00',
  pay: 'Pending',
  payTone: 'warning',
  status: 'Changes',
  statusTone: 'warning'
}, {
  i: 7,
  id: 'CZ-10019',
  cust: 'Michael Brown',
  date: '26 Jul 2026',
  amt: '$75.00',
  pay: 'Completed',
  payTone: 'success',
  status: 'Completed',
  statusTone: 'success'
}, {
  i: 8,
  id: 'CZ-10018',
  cust: 'Liu Wang',
  date: '25 Jul 2026',
  amt: '$60.00',
  pay: 'Cancelled',
  payTone: 'danger',
  status: 'Cancelled',
  statusTone: 'danger'
}];
const DESIGNS = [{
  i: 1,
  img: '../../assets/photo-fabric-cz.png',
  name: 'Floral Logo Design',
  cat: 'Logos',
  price: '$15.00',
  status: 'Published',
  tone: 'success'
}, {
  i: 2,
  img: '../../assets/photo-gold-stitch.png',
  name: 'Eagle Logo Design',
  cat: 'Logos',
  price: '$12.00',
  status: 'Published',
  tone: 'success'
}, {
  i: 3,
  img: '../../assets/photo-polo-navy.png',
  name: 'Butterfly Design',
  cat: 'Animals',
  price: '$18.00',
  status: 'Published',
  tone: 'success'
}, {
  i: 4,
  img: '../../assets/photo-polo-white.png',
  name: 'Rose Design',
  cat: 'Flowers',
  price: '$10.00',
  status: 'Published',
  tone: 'success'
}, {
  i: 5,
  img: '../../assets/photo-polo-black.png',
  name: 'Monogram A',
  cat: 'Logos',
  price: '$9.00',
  status: 'Draft',
  tone: 'warning'
}, {
  i: 6,
  img: '../../assets/photo-jacket-back.png',
  name: '3D Puff Design',
  cat: '3D Designs',
  price: '$24.00',
  status: 'Draft',
  tone: 'warning'
}, {
  i: 7,
  img: '../../assets/photo-fabric-cz.png',
  name: 'Heart Design',
  cat: 'Symbols',
  price: '$8.00',
  status: 'Published',
  tone: 'success'
}, {
  i: 8,
  img: '../../assets/photo-gold-stitch.png',
  name: 'Anchor Design',
  cat: 'Symbols',
  price: '$10.00',
  status: 'Published',
  tone: 'success'
}];
const TOP_DESIGNS = [{
  img: '../../assets/photo-fabric-cz.png',
  name: 'Floral Logo Design',
  sales: '124 sales',
  rev: '$1,200'
}, {
  img: '../../assets/photo-gold-stitch.png',
  name: 'Eagle Logo Design',
  sales: '98 sales',
  rev: '$980'
}, {
  img: '../../assets/photo-polo-navy.png',
  name: 'Butterfly Design',
  sales: '76 sales',
  rev: '$760'
}, {
  img: '../../assets/photo-polo-white.png',
  name: 'Rose Design',
  sales: '65 sales',
  rev: '$600'
}];
const ACTIVITY = [{
  icon: 'file-plus',
  tint: 'green',
  title: 'New Quote Request',
  meta: 'David Wilson submitted a quote request',
  time: '2 min ago',
  user: 'Muhammad Suleman',
  ip: '192.168.1.10'
}, {
  icon: 'package',
  tint: 'blue',
  title: 'New Order Placed',
  meta: 'Order #10024 from John Smith',
  time: '12 min ago',
  user: 'Ahmed Khan',
  ip: '103.45.67.89'
}, {
  icon: 'user-plus',
  tint: 'violet',
  title: 'New User Registration',
  meta: 'Maria Garcia created an account',
  time: '25 min ago',
  user: 'Admin',
  ip: '192.168.1.22'
}, {
  icon: 'refresh-cw',
  tint: 'gold',
  title: 'Order Status Updated',
  meta: 'Order #10012 is now Processing',
  time: '1 hour ago',
  user: 'Sara Ahmed',
  ip: '154.23.18.11'
}, {
  icon: 'message-square',
  tint: 'blue',
  title: 'New Message',
  meta: 'New message from Ahmed Khan',
  time: '2 hours ago',
  user: 'Admin',
  ip: '192.168.1.10'
}, {
  icon: 'credit-card',
  tint: 'green',
  title: 'Subscription Purchased',
  meta: 'Professional plan by Maria Garcia',
  time: '3 hours ago',
  user: 'Fatima Noor',
  ip: '201.44.90.03'
}, {
  icon: 'star',
  tint: 'gold',
  title: 'New Review',
  meta: '5-star review from Luca Rossi',
  time: '5 hours ago',
  user: 'John Smith',
  ip: '203.45.67.72'
}];
Object.assign(window, {
  CUSTOMERS,
  ORDERS,
  DESIGNS,
  TOP_DESIGNS,
  ACTIVITY
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin_panel/AdminData.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin_panel/AdminShell.jsx
try { (() => {
const {
  SidebarNav,
  Logo,
  Avatar,
  Icon,
  IconButton,
  Button
} = window.CZDigitizingDesignSystem_765273;

/* Visible navigation is deliberately short — eight destinations in three groups.
   Categories, Services, Downloads and Activity Log stay reachable from the pages
   they belong to (Designs, Orders, Reports) and from the notification bell. */
const NAV = [{
  section: 'Main'
}, {
  value: 'dashboard',
  label: 'Dashboard',
  icon: 'layout-dashboard'
}, {
  value: 'orders',
  label: 'Orders',
  icon: 'package'
}, {
  value: 'customers',
  label: 'Customers',
  icon: 'users'
}, {
  value: 'designs',
  label: 'Designs',
  icon: 'shirt'
}, {
  section: 'Business'
}, {
  value: 'payments',
  label: 'Payments',
  icon: 'credit-card'
}, {
  value: 'quotes',
  label: 'Quotes',
  icon: 'file-text'
}, {
  section: 'System'
}, {
  value: 'reports',
  label: 'Reports',
  icon: 'bar-chart-3'
}, {
  value: 'settings',
  label: 'Settings',
  icon: 'settings'
}];
function AdminShell({
  view,
  onNavigate,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: '100%',
      minHeight: '100vh'
    }
  }, /*#__PURE__*/React.createElement(SidebarNav, {
    items: NAV,
    value: view,
    onChange: onNavigate,
    header: /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '18px 16px 16px',
        borderBottom: '1px solid var(--border-on-navy)'
      }
    }, /*#__PURE__*/React.createElement(Logo, {
      variant: "dark",
      height: 34,
      assetBase: "../../assets"
    })),
    footer: /*#__PURE__*/React.createElement("div", {
      style: {
        borderTop: '1px solid var(--border-on-navy)',
        padding: '12px 12px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '0 3px 10px'
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: "Muhammad Suleman",
      size: 30
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        lineHeight: 1.25,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 'var(--text-2xs)',
        fontWeight: 600,
        color: 'var(--cz-white)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, "Muhammad Suleman Yaseen"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9,
        color: 'var(--gold-500)',
        letterSpacing: 'var(--tracking-wide)',
        textTransform: 'uppercase'
      }
    }, "Super Admin"))), /*#__PURE__*/React.createElement("button", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '9px 11px',
        background: 'none',
        border: 0,
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-on-navy-muted)',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--text-xs)',
        fontWeight: 500,
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "log-out",
      size: 15
    }), "Logout"))
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      minWidth: 0,
      overflow: 'auto',
      background: 'var(--surface-page)'
    }
  }, children));
}
function ViewHeader({
  title,
  subtitle,
  right,
  onBell
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 20,
      padding: '18px 24px',
      background: 'var(--surface-card)',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-h3)'
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, subtitle) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, right, /*#__PURE__*/React.createElement(IconButton, {
    icon: "bell",
    label: "Notifications",
    badge: 3,
    onClick: onBell
  })));
}

/* Dashboard header: greeting on the left, bell + profile + one primary action. */
function DashboardHeader({
  onBell,
  onNewOrder
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "cz-dash-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-h2)'
    }
  }, "Dashboard"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      marginTop: 4
    }
  }, "Welcome back, Muhammad Suleman Yaseen")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "bell",
    label: "Notifications",
    badge: 3,
    variant: "outline",
    onClick: onBell
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Muhammad Suleman",
    size: 34
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      lineHeight: 1.25
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xs)',
      fontWeight: 600,
      color: 'var(--text-strong)',
      whiteSpace: 'nowrap'
    }
  }, "Muhammad Suleman"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: 'var(--text-muted)',
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase'
    }
  }, "Super Admin"))), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    icon: "plus",
    onClick: onNewOrder
  }, "New Order")));
}
const BODY = {
  padding: 24,
  display: 'grid',
  gap: 18
};
Object.assign(window, {
  AdminShell,
  ViewHeader,
  DashboardHeader,
  BODY,
  NAV
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin_panel/AdminShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin_panel/CustomersView.jsx
try { (() => {
const {
  Card,
  DataTable,
  Badge,
  Button,
  SearchField,
  Select,
  Pagination,
  Avatar,
  Tabs,
  FlagChip,
  StatCard
} = window.CZDigitizingDesignSystem_765273;
function CustomerProfile({
  c,
  onBack
}) {
  const [tab, setTab] = React.useState('Order History');
  const HIST = [{
    i: 1,
    id: 'CZ-10025',
    date: '15 Aug 2026',
    designs: '3 designs',
    amt: '$45.00',
    pay: 'Paid'
  }, {
    i: 2,
    id: 'CZ-10023',
    date: '02 Jul 2026',
    designs: '2 designs',
    amt: '$32.00',
    pay: 'Paid'
  }, {
    i: 3,
    id: 'CZ-10016',
    date: '21 May 2026',
    designs: '1 design',
    amt: '$18.00',
    pay: 'Paid'
  }, {
    i: 4,
    id: 'CZ-10012',
    date: '10 Mar 2026',
    designs: '2 designs',
    amt: '$56.00',
    pay: 'Paid'
  }, {
    i: 5,
    id: 'CZ-10007',
    date: '05 Jan 2026',
    designs: '1 design',
    amt: '$20.00',
    pay: 'Paid'
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(ViewHeader, {
    title: "Customer Profile & History",
    subtitle: c.name + ' · #CUST-100' + c.i,
    right: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "outlineNavy",
      icon: "arrow-left",
      onClick: onBack
    }, "Back to Customers")
  }), /*#__PURE__*/React.createElement("div", {
    style: BODY
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: c.name,
    size: 64,
    ring: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 220
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-h3)'
    }
  }, c.name), /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral",
    size: "sm"
  }, "#CUST-100", c.i), /*#__PURE__*/React.createElement(Badge, {
    tone: c.status === 'Active' ? 'success' : 'neutral',
    size: "sm",
    dot: true
  }, c.status)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 3,
      marginTop: 8,
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("span", null, c.email), /*#__PURE__*/React.createElement("span", null, c.wa), /*#__PURE__*/React.createElement(FlagChip, {
    flag: c.flag,
    label: c.country
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-faint)'
    }
  }, "Member since: 10 Jan 2026"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12,
      minWidth: 340
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Total Orders",
    value: c.orders,
    icon: "package",
    tint: "blue"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Total Spent",
    value: c.spent,
    icon: "dollar-sign",
    tint: "gold"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Total Downloads",
    value: "18",
    icon: "download",
    tint: "violet"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Last Order",
    value: "15 Aug",
    icon: "calendar",
    tint: "green"
  })))), /*#__PURE__*/React.createElement(Card, {
    padding: "0"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, /*#__PURE__*/React.createElement(Tabs, {
    tabs: ['Order History', 'Cart History', 'Payment History', 'Download History', 'Activity Log'],
    value: tab,
    onChange: setTab
  })), /*#__PURE__*/React.createElement(DataTable, {
    rows: HIST,
    columns: [{
      header: '#',
      key: 'i',
      width: 44
    }, {
      header: 'Order ID',
      key: 'id',
      strong: true
    }, {
      header: 'Date',
      key: 'date'
    }, {
      header: 'Designs',
      key: 'designs'
    }, {
      header: 'Amount',
      key: 'amt'
    }, {
      header: 'Payment Status',
      cell: r => /*#__PURE__*/React.createElement(Badge, {
        tone: "success",
        size: "sm"
      }, r.pay)
    }, {
      header: 'Action',
      align: 'right',
      cell: () => /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        variant: "outlineNavy"
      }, "View")
    }]
  }))));
}
function CustomersView({
  customer,
  onOpen
}) {
  const [page, setPage] = React.useState(1);
  if (customer) return /*#__PURE__*/React.createElement(CustomerProfile, {
    c: customer,
    onBack: () => onOpen(null)
  });
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(ViewHeader, {
    title: "Customers",
    subtitle: "1,248 customers",
    right: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SearchField, {
      placeholder: "Search by name, email or WhatsApp\u2026",
      width: 330,
      size: "sm"
    }), /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      placeholder: "Filter",
      options: ['All', 'Active', 'Inactive'],
      style: {
        width: 110
      }
    }), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary",
      icon: "download"
    }, "Export"))
  }), /*#__PURE__*/React.createElement("div", {
    style: BODY
  }, /*#__PURE__*/React.createElement(Card, {
    padding: "0"
  }, /*#__PURE__*/React.createElement(DataTable, {
    rows: CUSTOMERS,
    columns: [{
      header: '#',
      key: 'i',
      width: 44
    }, {
      header: 'Name',
      strong: true,
      cell: r => /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 9
        }
      }, /*#__PURE__*/React.createElement(Avatar, {
        name: r.name,
        size: 26
      }), r.name)
    }, {
      header: 'Email',
      key: 'email'
    }, {
      header: 'WhatsApp',
      key: 'wa'
    }, {
      header: 'Country',
      cell: r => /*#__PURE__*/React.createElement(FlagChip, {
        flag: r.flag,
        label: r.country,
        size: 15
      })
    }, {
      header: 'Total Orders',
      key: 'orders',
      align: 'center'
    }, {
      header: 'Total Spent',
      key: 'spent',
      align: 'right'
    }, {
      header: 'Status',
      cell: r => /*#__PURE__*/React.createElement(Badge, {
        tone: r.status === 'Active' ? 'success' : 'neutral',
        size: "sm",
        dot: true
      }, r.status)
    }, {
      header: 'Action',
      align: 'right',
      cell: r => /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        variant: "outlineNavy",
        onClick: () => onOpen(r)
      }, "View")
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px'
    }
  }, /*#__PURE__*/React.createElement(Pagination, {
    page: page,
    pages: 156,
    onChange: setPage,
    summary: "Showing 1 to 8 of 1,248 customers"
  })))));
}
Object.assign(window, {
  CustomersView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin_panel/CustomersView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin_panel/DashboardView.jsx
try { (() => {
const {
  Card,
  SegmentedToggle,
  LineChart,
  Badge,
  DataTable,
  Icon
} = window.CZDigitizingDesignSystem_765273;
const REVENUE = {
  Week: [{
    label: 'Mon',
    value: 1150
  }, {
    label: 'Tue',
    value: 1620
  }, {
    label: 'Wed',
    value: 1380
  }, {
    label: 'Thu',
    value: 2040
  }, {
    label: 'Fri',
    value: 2480
  }, {
    label: 'Sat',
    value: 1720
  }, {
    label: 'Sun',
    value: 900
  }],
  Month: [{
    label: 'Jan',
    value: 22400
  }, {
    label: 'Feb',
    value: 26800
  }, {
    label: 'Mar',
    value: 25100
  }, {
    label: 'Apr',
    value: 31600
  }, {
    label: 'May',
    value: 29400
  }, {
    label: 'Jun',
    value: 37200
  }, {
    label: 'Jul',
    value: 42800
  }, {
    label: 'Aug',
    value: 48750
  }],
  Year: [{
    label: '2022',
    value: 112000
  }, {
    label: '2023',
    value: 168000
  }, {
    label: '2024',
    value: 214000
  }, {
    label: '2025',
    value: 286000
  }, {
    label: '2026',
    value: 341000
  }]
};
const RECENT = [{
  id: 'CZ-10025',
  cust: 'Ahmed Khan',
  design: 'Floral Logo Design',
  status: 'Completed',
  tone: 'success',
  amt: '$45.00',
  date: '15 Aug 2026'
}, {
  id: 'CZ-10024',
  cust: 'Sara Ahmed',
  design: '3D Puff Cap Logo',
  status: 'Processing',
  tone: 'gold',
  amt: '$68.00',
  date: '14 Aug 2026'
}, {
  id: 'CZ-10023',
  cust: 'Ali Raza',
  design: 'Jacket Back Crest',
  status: 'Review',
  tone: 'info',
  amt: '$120.00',
  date: '14 Aug 2026'
}, {
  id: 'CZ-10022',
  cust: 'Fatima Noor',
  design: 'Rose Design',
  status: 'Completed',
  tone: 'success',
  amt: '$35.00',
  date: '12 Aug 2026'
}, {
  id: 'CZ-10021',
  cust: 'John Smith',
  design: 'Eagle Logo Design',
  status: 'Pending',
  tone: 'danger',
  amt: '$90.00',
  date: '11 Aug 2026'
}];
function ViewAll({
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      background: 'none',
      border: 0,
      padding: 0,
      cursor: 'pointer',
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      color: 'var(--gold-600)'
    }
  }, "View All ", /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-right",
    size: 13
  }));
}

/* KPI tile. `accent` raises Pending Orders above the other two: navy ground,
   gold figure, gold hairline — the most actionable number on the page. */
function Kpi({
  label,
  value,
  delta,
  deltaTone = 'up',
  icon,
  accent
}) {
  const deltaColor = accent ? 'var(--gold-400)' : deltaTone === 'up' ? 'var(--green-600)' : 'var(--amber-600)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 24px',
      borderRadius: 'var(--radius-lg)',
      background: accent ? 'var(--surface-navy)' : 'var(--surface-card)',
      border: '1px solid ' + (accent ? 'var(--gold-500)' : 'var(--border-subtle)'),
      boxShadow: accent ? 'var(--shadow-navy)' : 'var(--shadow-sm)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-2xs)',
      fontWeight: 600,
      letterSpacing: 'var(--tracking-wider)',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      color: accent ? 'var(--gold-500)' : 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      color: accent ? 'var(--gold-500)' : 'var(--text-faint)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: icon,
    size: 17
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 44,
      fontWeight: 700,
      lineHeight: 1.05,
      letterSpacing: 'var(--tracking-tight)',
      marginTop: 14,
      color: accent ? 'var(--gold-500)' : 'var(--text-strong)'
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      color: deltaColor,
      marginTop: 8
    }
  }, delta));
}
function DashboardView({
  go
}) {
  const [range, setRange] = React.useState('Month');
  const series = REVENUE[range];
  const money = v => '$' + (v >= 1000 ? Math.round(v / 1000) + 'k' : Math.round(v));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("style", null, `
      .cz-dash-head{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:26px 34px;background:var(--surface-card);border-bottom:1px solid var(--border-subtle);flex-wrap:wrap}
      .cz-dash{padding:34px;display:grid;gap:34px;max-width:1440px}
      .cz-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
      .cz-split{display:grid;grid-template-columns:1.55fr 1fr;gap:22px;align-items:start}
      .cz-scroll{overflow-x:auto}
      @media (max-width:1180px){.cz-split{grid-template-columns:1fr}}
      @media (max-width:900px){.cz-dash{padding:22px;gap:24px}.cz-dash-head{padding:20px 22px}.cz-kpis{grid-template-columns:1fr;gap:16px}}
    `), /*#__PURE__*/React.createElement(DashboardHeader, {
    onBell: () => go('activity'),
    onNewOrder: () => go('orders')
  }), /*#__PURE__*/React.createElement("div", {
    className: "cz-dash"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cz-kpis"
  }, /*#__PURE__*/React.createElement(Kpi, {
    label: "Total Orders",
    value: "892",
    delta: "+18% this month",
    icon: "package"
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Total Revenue",
    value: "$48,750",
    delta: "+22% this month",
    icon: "dollar-sign"
  }), /*#__PURE__*/React.createElement(Kpi, {
    label: "Pending Orders",
    value: "23",
    delta: "Needs attention",
    icon: "clock",
    accent: true
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Revenue Overview",
    padding: "var(--space-6)",
    action: /*#__PURE__*/React.createElement(SegmentedToggle, {
      size: "sm",
      options: ['Week', 'Month', 'Year'],
      value: range,
      onChange: setRange
    })
  }, /*#__PURE__*/React.createElement(LineChart, {
    height: 260,
    data: series,
    valueFormat: money,
    gridLines: 4
  })), /*#__PURE__*/React.createElement("div", {
    className: "cz-split"
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Recent Orders",
    padding: "0",
    action: /*#__PURE__*/React.createElement(ViewAll, {
      onClick: () => go('orders')
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "cz-scroll",
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(DataTable, {
    rows: RECENT,
    columns: [{
      header: 'Order ID',
      key: 'id',
      strong: true
    }, {
      header: 'Customer',
      key: 'cust'
    }, {
      header: 'Design',
      key: 'design'
    }, {
      header: 'Status',
      cell: r => /*#__PURE__*/React.createElement(Badge, {
        tone: r.tone,
        size: "sm"
      }, r.status)
    }, {
      header: 'Amount',
      key: 'amt',
      align: 'right'
    }, {
      header: 'Date',
      key: 'date',
      align: 'right'
    }]
  }))), /*#__PURE__*/React.createElement(Card, {
    title: "Top Selling Designs",
    padding: "var(--space-5)",
    action: /*#__PURE__*/React.createElement(ViewAll, {
      onClick: () => go('designs')
    })
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 18
    }
  }, TOP_DESIGNS.map(d => /*#__PURE__*/React.createElement("div", {
    key: d.name,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: d.img,
    alt: "",
    style: {
      width: 46,
      height: 46,
      objectFit: 'cover',
      borderRadius: 'var(--radius-md)',
      display: 'block',
      flex: '0 0 auto'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: 'var(--text-strong)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, d.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xs)',
      color: 'var(--text-faint)',
      marginTop: 2
    }
  }, d.sales)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-md)',
      fontWeight: 700,
      color: 'var(--gold-700)'
    }
  }, d.rev))))))));
}
Object.assign(window, {
  DashboardView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin_panel/DashboardView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin_panel/DesignsView.jsx
try { (() => {
const {
  Card,
  DataTable,
  Badge,
  Button,
  SearchField,
  Select,
  Pagination,
  SegmentedToggle,
  IconButton
} = window.CZDigitizingDesignSystem_765273;
function DesignsView() {
  const [layout, setLayout] = React.useState('Table');
  const [page, setPage] = React.useState(1);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(ViewHeader, {
    title: "Designs",
    subtitle: "256 designs",
    right: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SegmentedToggle, {
      size: "sm",
      options: ['Table', 'Grid'],
      value: layout,
      onChange: setLayout
    }), /*#__PURE__*/React.createElement(SearchField, {
      placeholder: "Search designs\u2026",
      width: 220,
      size: "sm"
    }), /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      placeholder: "All Categories",
      options: ['All Categories', 'Logos', 'Animals', 'Flowers', 'Symbols', '3D Designs'],
      style: {
        width: 150
      }
    }), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary",
      icon: "plus"
    }, "New Design"))
  }), /*#__PURE__*/React.createElement("div", {
    style: BODY
  }, /*#__PURE__*/React.createElement(Card, {
    padding: "0"
  }, layout === 'Table' ? /*#__PURE__*/React.createElement(DataTable, {
    rows: DESIGNS,
    columns: [{
      header: '#',
      key: 'i',
      width: 44
    }, {
      header: 'Image',
      width: 70,
      cell: r => /*#__PURE__*/React.createElement("img", {
        src: r.img,
        alt: "",
        style: {
          width: 44,
          height: 44,
          objectFit: 'cover',
          borderRadius: 'var(--radius-sm)',
          display: 'block'
        }
      })
    }, {
      header: 'Design Name',
      key: 'name',
      strong: true
    }, {
      header: 'Category',
      key: 'cat'
    }, {
      header: 'Price',
      key: 'price',
      align: 'right'
    }, {
      header: 'Status',
      cell: r => /*#__PURE__*/React.createElement(Badge, {
        tone: r.tone,
        size: "sm"
      }, r.status)
    }, {
      header: 'Action',
      align: 'right',
      cell: () => /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'inline-flex',
          gap: 6
        }
      }, /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        variant: "outlineNavy"
      }, "View"), /*#__PURE__*/React.createElement(IconButton, {
        icon: "pencil",
        label: "Edit",
        size: 30
      }))
    }]
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 16,
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 14
    }
  }, DESIGNS.map(d => /*#__PURE__*/React.createElement("div", {
    key: d.i,
    style: {
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-card)',
      overflow: 'hidden',
      background: 'var(--surface-card)'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: d.img,
    alt: "",
    style: {
      width: '100%',
      height: 110,
      objectFit: 'cover',
      display: 'block'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, d.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, d.cat, " \xB7 ", d.price), /*#__PURE__*/React.createElement(Badge, {
    tone: d.tone,
    size: "sm"
  }, d.status)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px'
    }
  }, /*#__PURE__*/React.createElement(Pagination, {
    page: page,
    pages: 32,
    onChange: setPage,
    summary: "Showing 1 to 8 of 256 designs"
  })))));
}
Object.assign(window, {
  DesignsView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin_panel/DesignsView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin_panel/OrdersView.jsx
try { (() => {
const {
  Card,
  DataTable,
  Badge,
  Button,
  SearchField,
  Select,
  Pagination,
  IconButton
} = window.CZDigitizingDesignSystem_765273;
function PaymentDetail({
  o,
  onClose
}) {
  const {
    Card: C,
    Badge: B,
    Button: Bt
  } = window.CZDigitizingDesignSystem_765273;
  return /*#__PURE__*/React.createElement(Card, {
    title: 'Payment Details · ' + o.id,
    action: /*#__PURE__*/React.createElement(Bt, {
      size: "sm",
      variant: "ghost",
      onClick: onClose
    }, "Close")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xs)',
      fontWeight: 600,
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      marginBottom: 8
    }
  }, "Customer"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, o.cust), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      marginTop: 3
    }
  }, "ahmed@gmail.com"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, "WhatsApp: +92 300 1234567")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xs)',
      fontWeight: 600,
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      marginBottom: 8
    }
  }, "Payment Information"), [['Amount', o.amt], ['Currency', 'USD'], ['Method', 'Bank Transfer'], ['Date', o.date + ', 10:24 AM'], ['Receipt', 'View Receipt']].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 'var(--text-xs)',
      padding: '3px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)'
    }
  }, k), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-strong)',
      fontWeight: 600
    }
  }, v))), /*#__PURE__*/React.createElement(Badge, {
    tone: "success",
    size: "sm",
    icon: "check",
    style: {
      marginTop: 8
    }
  }, "Payment Confirmed")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xs)',
      fontWeight: 600,
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      marginBottom: 8
    }
  }, "Order Items"), [['Floral Logo Design', '1x DST, PES, JEF', '$30.00'], ['Butterfly Design', '1x DST, PES', '$15.00']].map(([n, d, p]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: 10,
      padding: '6px 0',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 9,
      color: 'var(--text-faint)'
    }
  }, d)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      fontWeight: 600
    }
  }, p))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 8,
      fontSize: 'var(--text-sm)',
      fontWeight: 700,
      color: 'var(--text-strong)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Total"), /*#__PURE__*/React.createElement("span", null, o.amt)))));
}
function OrdersView() {
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(ViewHeader, {
    title: "Orders",
    subtitle: "892 orders",
    right: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      placeholder: "All Status",
      options: ['All Status', 'Completed', 'In Progress', 'Pending', 'Cancelled'],
      style: {
        width: 130
      }
    }), /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      placeholder: "Date Range",
      options: ['Last 7 Days', 'Last 30 Days', 'This Year'],
      style: {
        width: 130
      }
    }), /*#__PURE__*/React.createElement(SearchField, {
      placeholder: "Search by order ID or customer\u2026",
      width: 280,
      size: "sm"
    }), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary",
      icon: "download"
    }, "Export"))
  }), /*#__PURE__*/React.createElement("div", {
    style: BODY
  }, open ? /*#__PURE__*/React.createElement(PaymentDetail, {
    o: open,
    onClose: () => setOpen(null)
  }) : null, /*#__PURE__*/React.createElement(Card, {
    padding: "0"
  }, /*#__PURE__*/React.createElement(DataTable, {
    rows: ORDERS,
    columns: [{
      header: '#',
      key: 'i',
      width: 44
    }, {
      header: 'Order ID',
      key: 'id',
      strong: true
    }, {
      header: 'Customer',
      key: 'cust'
    }, {
      header: 'Date',
      key: 'date'
    }, {
      header: 'Amount',
      key: 'amt',
      align: 'right'
    }, {
      header: 'Payment Status',
      cell: r => /*#__PURE__*/React.createElement(Badge, {
        tone: r.payTone,
        size: "sm"
      }, r.pay)
    }, {
      header: 'Order Status',
      cell: r => /*#__PURE__*/React.createElement(Badge, {
        tone: r.statusTone,
        size: "sm"
      }, r.status)
    }, {
      header: 'Action',
      align: 'right',
      cell: r => /*#__PURE__*/React.createElement("span", {
        style: {
          display: 'inline-flex',
          gap: 6
        }
      }, /*#__PURE__*/React.createElement(Button, {
        size: "sm",
        variant: "outlineNavy",
        onClick: () => setOpen(r)
      }, "View"), /*#__PURE__*/React.createElement(IconButton, {
        icon: "more-horizontal",
        label: "More",
        size: 30
      }))
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px'
    }
  }, /*#__PURE__*/React.createElement(Pagination, {
    page: page,
    pages: 112,
    onChange: setPage,
    summary: "Showing 1 to 8 of 892 orders"
  })))));
}
Object.assign(window, {
  OrdersView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin_panel/OrdersView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/admin_panel/ReportsView.jsx
try { (() => {
const {
  Card,
  StatCard,
  BarChart,
  DonutStat,
  Select,
  Button,
  SegmentedToggle,
  IconTile
} = window.CZDigitizingDesignSystem_765273;
function ReportsView() {
  const [range, setRange] = React.useState('Month');
  const EXPORTS = [['users', 'Customer History', 'Export customer data'], ['package', 'Orders History', 'Export orders data'], ['credit-card', 'Payments History', 'Export payments data'], ['shopping-bag', 'Purchased Files', 'Export purchased files'], ['download', 'Download History', 'Export download logs'], ['shopping-cart', 'Cart History', 'Export cart data'], ['shirt', 'Designs Data', 'Export designs data'], ['folder', 'Categories Data', 'Export categories'], ['database', 'All Data', 'Export complete database']];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(ViewHeader, {
    title: "Reports & Analytics",
    subtitle: "01 Aug 2026 \u2013 24 Aug 2026",
    right: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SegmentedToggle, {
      size: "sm",
      options: ['Week', 'Month', 'Year'],
      value: range,
      onChange: setRange
    }), /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      placeholder: "Last 30 Days",
      options: ['Last 7 Days', 'Last 30 Days', 'This Year'],
      style: {
        width: 140
      }
    }), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "secondary",
      icon: "download"
    }, "Export Now"))
  }), /*#__PURE__*/React.createElement("div", {
    style: BODY
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Total Sales",
    value: "$4,850",
    delta: "+18%",
    icon: "dollar-sign",
    tint: "gold"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Total Orders",
    value: "124",
    delta: "+12%",
    icon: "package",
    tint: "blue"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "New Customers",
    value: "38",
    delta: "+25%",
    icon: "user-plus",
    tint: "green"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Conversion Rate",
    value: "3.6%",
    delta: "+0.4%",
    icon: "trending-up",
    tint: "violet"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.5fr 1fr',
      gap: 18,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Sales Overview"
  }, /*#__PURE__*/React.createElement(BarChart, {
    height: 190,
    data: [{
      label: 'Aug 1',
      value: 12
    }, {
      label: 'Aug 5',
      value: 17
    }, {
      label: 'Aug 9',
      value: 14
    }, {
      label: 'Aug 13',
      value: 21
    }, {
      label: 'Aug 17',
      value: 19
    }, {
      label: 'Aug 21',
      value: 26
    }, {
      label: 'Aug 24',
      value: 23
    }]
  })), /*#__PURE__*/React.createElement(Card, {
    title: "Top Categories"
  }, /*#__PURE__*/React.createElement(DonutStat, {
    size: 126,
    segments: [{
      label: 'Logos',
      value: 42,
      color: 'var(--gold-500)'
    }, {
      label: 'Animals',
      value: 18,
      color: 'var(--blue-600)'
    }, {
      label: 'Flowers',
      value: 15,
      color: 'var(--green-600)'
    }, {
      label: 'Symbols',
      value: 12,
      color: 'var(--violet-600)'
    }, {
      label: '3D Designs',
      value: 8,
      color: 'var(--navy-500)'
    }, {
      label: 'Others',
      value: 5,
      color: 'var(--gray-400)'
    }]
  }))), /*#__PURE__*/React.createElement(Card, {
    title: "Export Data",
    action: /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--text-xs)',
        color: 'var(--text-muted)'
      }
    }, "Download your data in Excel or CSV")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 12
    }
  }, EXPORTS.map(([ic, t, d]) => /*#__PURE__*/React.createElement("button", {
    key: t,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      textAlign: 'left',
      cursor: 'pointer',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      transition: 'var(--transition-control)'
    }
  }, /*#__PURE__*/React.createElement(IconTile, {
    icon: ic,
    size: 34,
    tone: "goldSoft"
  }), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, t), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      fontSize: 9,
      color: 'var(--text-faint)',
      marginTop: 2
    }
  }, d))))))));
}
Object.assign(window, {
  ReportsView
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/admin_panel/ReportsView.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/CartPage.jsx
try { (() => {
const {
  Card,
  DataTable,
  Button,
  IconButton,
  Accordion,
  Badge
} = window.CZDigitizingDesignSystem_765273;
const money = n => '$' + n.toFixed(2);
function CartPage({
  go
}) {
  const [items, setItems] = React.useState([{
    img: '../../assets/photo-fabric-cz.png',
    name: 'Royal Eagle Logo',
    svc: 'Logo Service',
    size: '4in x 4in',
    qty: 2,
    price: 12,
    sub: 24
  }, {
    img: '../../assets/photo-gold-stitch.png',
    name: '3D Puff Cap Logo',
    svc: 'Cap Digitizing',
    size: '3in x 3in',
    qty: 1,
    price: 18,
    sub: 18
  }]);
  const total = items.reduce((s, i) => s + i.sub, 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...PAGE,
      padding: '32px 24px'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      marginBottom: 16
    }
  }, "Your Cart"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr',
      gap: 24,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: "0"
  }, /*#__PURE__*/React.createElement(DataTable, {
    rows: items,
    columns: [{
      header: 'Design',
      width: 70,
      cell: r => /*#__PURE__*/React.createElement("img", {
        src: r.img,
        alt: "",
        style: {
          width: 46,
          height: 46,
          objectFit: 'cover',
          borderRadius: 'var(--radius-sm)',
          display: 'block'
        }
      })
    }, {
      header: 'Name & Details',
      cell: r => /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        style: {
          fontWeight: 600,
          color: 'var(--text-strong)'
        }
      }, r.name), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 'var(--text-2xs)',
          color: 'var(--text-faint)'
        }
      }, r.svc))
    }, {
      header: 'Size',
      key: 'size'
    }, {
      header: 'Qty',
      key: 'qty',
      align: 'center'
    }, {
      header: 'Price',
      align: 'right',
      cell: r => money(r.price)
    }, {
      header: 'Subtotal',
      align: 'right',
      strong: true,
      cell: r => money(r.sub)
    }, {
      header: 'Action',
      align: 'right',
      cell: (r, i) => /*#__PURE__*/React.createElement(IconButton, {
        icon: "trash-2",
        label: "Remove",
        onClick: () => setItems(items.filter((_, x) => x !== i))
      })
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "ghost",
    size: "sm",
    icon: "arrow-left",
    onClick: () => go('Services')
  }, "Continue Shopping"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, "Total"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 26,
      fontWeight: 700,
      color: 'var(--text-strong)'
    }
  }, money(total))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Order Summary"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 8,
      fontSize: 'var(--text-sm)'
    }
  }, items.map(i => /*#__PURE__*/React.createElement("div", {
    key: i.name,
    style: {
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-muted)'
    }
  }, i.name, " \xD7 ", i.qty), /*#__PURE__*/React.createElement("span", null, money(i.sub)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      paddingTop: 8,
      borderTop: '1px solid var(--border-subtle)',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Total"), /*#__PURE__*/React.createElement("span", null, money(total))), /*#__PURE__*/React.createElement(Badge, {
    tone: "goldSoft",
    size: "sm",
    icon: "info",
    style: {
      justifySelf: 'start',
      marginTop: 4
    }
  }, "Files delivered within 24 hours"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    block: true,
    size: "lg",
    style: {
      marginTop: 6
    }
  }, "Proceed to Checkout"))), /*#__PURE__*/React.createElement(Card, {
    title: "Cart Questions"
  }, /*#__PURE__*/React.createElement(Accordion, {
    items: [{
      q: 'What file formats do you provide?',
      a: 'DST, PES, JEF, EXP and more.'
    }, {
      q: 'How long does digitizing take?',
      a: 'Same day for most orders.'
    }, {
      q: 'What information do you need from me?',
      a: 'Artwork, size, fabric and machine format.'
    }, {
      q: 'Can I upload my design?',
      a: 'Yes, at checkout or on the quote form.'
    }]
  })))));
}
Object.assign(window, {
  CartPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/CartPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/HomePage.jsx
try { (() => {
const {
  Button,
  Eyebrow,
  ServiceCard,
  TestimonialCard
} = window.CZDigitizingDesignSystem_765273;
function HomePage({
  go
}) {
  const SERVICES = [{
    t: 'Embroidery Digitizing',
    d: 'Convert your artwork into perfect stitches.',
    img: '../../assets/photo-fabric-cz.png'
  }, {
    t: 'Vector Art',
    d: 'Make your artwork sharp, scalable and ready to print.',
    img: '../../assets/photo-gold-stitch.png'
  }];
  const QUOTES = [{
    q: 'Exceptional quality and very professional service. Highly recommended.',
    n: 'Sarah Johnson',
    c: 'USA',
    f: 'US'
  }, {
    q: 'Great communication and perfect stitch files. Will work with them again for sure.',
    n: 'Ahmed Khan',
    c: 'UAE',
    f: 'AE'
  }, {
    q: 'Amazing detail and precision. Their team is the best in the industry.',
    n: 'Marie Dupont',
    c: 'France',
    f: 'FR'
  }, {
    q: 'Very satisfied with the results. Their team is professional and reliable.',
    n: 'Luca Rossi',
    c: 'Italy',
    f: 'IT'
  }];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("section", {
    style: {
      position: 'relative',
      background: 'var(--surface-navy)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/photo-embroidery-machine.png",
    alt: "",
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      opacity: .55
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(90deg,rgba(11,19,43,.95) 0%,rgba(11,19,43,.74) 55%,rgba(11,19,43,.35) 100%)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...PAGE,
      position: 'relative',
      padding: '64px 24px 56px'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Machine Embroidery Design"), /*#__PURE__*/React.createElement("h1", {
    style: {
      color: 'var(--cz-white)',
      fontSize: 'var(--text-hero)',
      lineHeight: 'var(--lh-hero)',
      marginTop: 12,
      maxWidth: 640
    }
  }, "Premium Embroidery", /*#__PURE__*/React.createElement("br", null), "Digitizing & Vector Art ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--gold-500)'
    }
  }, "Services")), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 16,
      maxWidth: 520,
      fontSize: 'var(--text-md)',
      color: 'var(--text-on-navy-muted)'
    }
  }, "High-quality digitizing and vector solutions for your business, brand and creative projects."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      marginTop: 26
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    iconAfter: "arrow-right",
    onClick: () => go('Get a Quote')
  }, "Get a Quote"), /*#__PURE__*/React.createElement(Button, {
    variant: "onNavy",
    size: "lg",
    onClick: () => go('Services')
  }, "Explore Services")))), /*#__PURE__*/React.createElement(TrustStrip, null), /*#__PURE__*/React.createElement("section", {
    style: {
      ...PAGE,
      padding: '52px 24px 0'
    }
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "What We Do",
    title: "Our Services",
    sub: "Two core services, both delivered with the same precision."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 20,
      marginTop: 24
    }
  }, SERVICES.map(s => /*#__PURE__*/React.createElement(ServiceCard, {
    key: s.t,
    image: s.img,
    title: s.t,
    description: s.d,
    linkLabel: "Explore Service",
    onClick: e => {
      e.preventDefault();
      go('Services');
    }
  })))), /*#__PURE__*/React.createElement("section", {
    style: {
      ...PAGE,
      padding: '52px 24px'
    }
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "Testimonials",
    title: "What Our Customers Say"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16,
      marginTop: 24
    }
  }, QUOTES.map(q => /*#__PURE__*/React.createElement(TestimonialCard, {
    key: q.n,
    quote: q.q,
    name: q.n,
    country: q.c,
    flag: q.f
  })))), /*#__PURE__*/React.createElement(CtaBand, {
    go: go
  }));
}
Object.assign(window, {
  HomePage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/HomePage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/PricingPage.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  SegmentedToggle,
  PricingCard,
  CreditPack,
  Card,
  Button,
  Icon
} = window.CZDigitizingDesignSystem_765273;
const PLANS = [{
  name: 'Starter',
  price: '$19',
  blurb: 'Perfect for small projects',
  features: ['10 Designs / Month', 'Standard Turnaround', 'Basic Support']
}, {
  name: 'Professional',
  price: '$49',
  blurb: 'Ideal for growing business',
  featured: true,
  features: ['50 Designs / Month', 'Priority Support', 'Faster Turnaround', '10% Discount']
}, {
  name: 'Business',
  price: '$99',
  blurb: 'For high volume users',
  features: ['150 Designs / Month', 'Dedicated Support', 'Faster Turnaround', '20% Discount']
}];
const PACKS = [{
  credits: '10',
  label: '10 Credits',
  price: '$15',
  unit: '($1.50 per credit)'
}, {
  credits: '25',
  label: '25 Credits',
  price: '$35',
  unit: '($1.40 per credit)',
  featured: true
}, {
  credits: '50',
  label: '50 Credits',
  price: '$65',
  unit: '($1.30 per credit)'
}, {
  credits: '100',
  label: '100 Credits',
  price: '$120',
  unit: '($1.20 per credit)'
}];
function PricingPage({
  go
}) {
  const [mode, setMode] = React.useState('Subscription Plans');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-navy)',
      padding: '40px 0 26px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: PAGE
  }, /*#__PURE__*/React.createElement(SectionHead, {
    tone: "navy",
    align: "center",
    title: "Pricing Plans",
    sub: "Choose the best plan for your needs."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(SegmentedToggle, {
    tone: "navy",
    options: ['Subscription Plans', 'Buy Credits'],
    value: mode,
    onChange: setMode
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...PAGE,
      padding: '40px 24px'
    }
  }, mode === 'Subscription Plans' ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 22,
      maxWidth: 900,
      margin: '0 auto'
    }
  }, PLANS.map(p => /*#__PURE__*/React.createElement(PricingCard, _extends({
    key: p.name
  }, p)))) : /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 900,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: 4
    }
  }, "Purchase Credits"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, "Buy credits anytime and use them for your orders."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16,
      marginTop: 22
    }
  }, PACKS.map(p => /*#__PURE__*/React.createElement(CreditPack, _extends({
    key: p.credits
  }, p))))), /*#__PURE__*/React.createElement(Card, {
    tone: "navy",
    style: {
      marginTop: 28,
      maxWidth: 900,
      marginLeft: 'auto',
      marginRight: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--gold-500)',
      display: 'inline-flex'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "crown",
    size: 26
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-h4)',
      fontWeight: 700,
      color: 'var(--cz-white)'
    }
  }, "Save More with a Subscription"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-on-navy-muted)',
      marginTop: 3
    }
  }, "Get better rates, priority support and exclusive benefits."))), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => setMode('Subscription Plans')
  }, "View Plans")))));
}
Object.assign(window, {
  PricingPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/PricingPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/QuotePage.jsx
try { (() => {
const {
  Card,
  FormField,
  Input,
  Select,
  Textarea,
  FileField,
  Button,
  Accordion,
  IconTile,
  Icon
} = window.CZDigitizingDesignSystem_765273;
const SERVICES = [['pen-tool', 'Embroidery Digitizing'], ['pen-line', 'Vector Art'], ['shapes', 'Logo Digitizing'], ['hard-hat', 'Cap Digitizing'], ['layers', '3D Puff'], ['badge-check', 'Patch'], ['scissors', 'Applique'], ['shirt', 'Jacket Back'], ['ellipsis', 'Other']];
const FAQ = [{
  q: 'What file formats do you provide?',
  a: 'DST, PES, JEF, EXP and any other format your machine needs.'
}, {
  q: 'How long does digitizing take?',
  a: 'Most orders are delivered the same day; complex jacket-back designs take up to 24 hours.'
}, {
  q: 'What information do you need from me?',
  a: 'Your artwork, the finished size, the fabric or garment type and your machine format.'
}, {
  q: 'Can I upload my design?',
  a: 'Yes — attach it to this form in AI, EPS, PDF, PNG or JPG.'
}, {
  q: 'Can I get a revision?',
  a: 'Revisions are free until the file stitches out the way you want it.'
}];
function QuotePage({
  go
}) {
  const [service, setService] = React.useState('Embroidery Digitizing');
  const [sent, setSent] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-navy)',
      padding: '40px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: PAGE
  }, /*#__PURE__*/React.createElement(SectionHead, {
    tone: "navy",
    title: "Get a Quote",
    sub: "Get a personalised quote for your design and service."
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...PAGE,
      padding: '36px 24px',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 24,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Card, {
    title: "1. Select Service"
  }, /*#__PURE__*/React.createElement(Select, {
    placeholder: "Choose a service",
    options: SERVICES.map(s => s[1]),
    value: service,
    onChange: e => setService(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 10,
      marginTop: 14
    }
  }, SERVICES.map(([ic, label]) => {
    const on = label === service;
    return /*#__PURE__*/React.createElement("button", {
      key: label,
      onClick: () => setService(label),
      style: {
        display: 'grid',
        justifyItems: 'center',
        gap: 6,
        padding: '12px 6px',
        cursor: 'pointer',
        background: on ? 'var(--surface-gold-soft)' : 'var(--surface-card)',
        border: '1px solid ' + (on ? 'var(--gold-500)' : 'var(--border-subtle)'),
        borderRadius: 'var(--radius-md)',
        transition: 'var(--transition-control)'
      }
    }, /*#__PURE__*/React.createElement(IconTile, {
      icon: ic,
      size: 34,
      tone: on ? 'goldSolid' : 'goldOutline'
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 'var(--text-2xs)',
        fontWeight: 600,
        color: 'var(--text-strong)',
        textAlign: 'center'
      }
    }, label));
  }))), /*#__PURE__*/React.createElement(Card, {
    title: "2. Common Questions"
  }, /*#__PURE__*/React.createElement(Accordion, {
    items: FAQ,
    defaultOpen: 0
  }))), /*#__PURE__*/React.createElement(Card, {
    title: "3. Quote Form"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(FormField, {
    label: "Full Name",
    required: true
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Full Name"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(FormField, {
    label: "Email",
    required: true
  }, /*#__PURE__*/React.createElement(Input, {
    icon: "mail",
    placeholder: "you@company.com"
  })), /*#__PURE__*/React.createElement(FormField, {
    label: "WhatsApp Number",
    required: true
  }, /*#__PURE__*/React.createElement(Input, {
    icon: "phone",
    placeholder: "+92 317 4604508"
  }))), /*#__PURE__*/React.createElement(FormField, {
    label: "Country"
  }, /*#__PURE__*/React.createElement(Select, {
    placeholder: "Select Country",
    options: ['Pakistan', 'United States', 'United Kingdom', 'Canada', 'Germany', 'UAE']
  })), /*#__PURE__*/React.createElement(FormField, {
    label: "Design Upload",
    required: true
  }, /*#__PURE__*/React.createElement(FileField, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xs)',
      fontWeight: 600,
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, "Service Details"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(FormField, {
    label: "Size"
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "e.g. 4in x 4.5in",
    size: "sm"
  })), /*#__PURE__*/React.createElement(FormField, {
    label: "Quantity"
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Quantity",
    size: "sm"
  })), /*#__PURE__*/React.createElement(FormField, {
    label: "Fabric / Garment"
  }, /*#__PURE__*/React.createElement(Select, {
    size: "sm",
    placeholder: "Select fabric",
    options: ['Cotton', 'Polo Piqué', 'Denim', 'Fleece', 'Cap']
  })), /*#__PURE__*/React.createElement(FormField, {
    label: "Thread Colour"
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "e.g. Gold, Navy",
    size: "sm"
  })), /*#__PURE__*/React.createElement(FormField, {
    label: "File Format"
  }, /*#__PURE__*/React.createElement(Select, {
    size: "sm",
    placeholder: "DST, PES, JEF",
    options: ['DST', 'PES', 'JEF', 'EXP']
  })), /*#__PURE__*/React.createElement(FormField, {
    label: "Deadline"
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "e.g. 3 days",
    size: "sm"
  }))), /*#__PURE__*/React.createElement(FormField, {
    label: "Special Instructions"
  }, /*#__PURE__*/React.createElement(Textarea, {
    rows: 3,
    placeholder: "Any additional details\u2026"
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    block: true,
    size: "lg",
    onClick: () => setSent(true)
  }, "Submit Quote Request"), sent ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 12px',
      background: 'var(--status-paid-bg)',
      color: 'var(--status-paid-fg)',
      borderRadius: 'var(--radius-md)',
      fontSize: 'var(--text-xs)',
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "circle-check",
    size: 15
  }), "Quote request received. We will reply on WhatsApp within 2 hours.") : null))));
}
Object.assign(window, {
  QuotePage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/QuotePage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/ServicesPage.jsx
try { (() => {
const {
  SegmentedToggle,
  ServiceCard,
  Button,
  Card
} = window.CZDigitizingDesignSystem_765273;
const EMB = [{
  t: 'Logo Digitizing',
  d: 'Perfect for logos and branding.',
  img: '../../assets/photo-fabric-cz.png'
}, {
  t: 'Cap & Hat Digitizing',
  d: 'Ideal for caps and hats.',
  img: '../../assets/photo-polo-navy.png'
}, {
  t: '3D Puff Digitizing',
  d: 'Adds depth and dimension.',
  img: '../../assets/photo-gold-stitch.png'
}, {
  t: 'Left Chest Digitizing',
  d: 'Professional and clean.',
  img: '../../assets/photo-polo-white.png'
}, {
  t: 'Jacket Back Digitizing',
  d: 'Large designs with detailed stitching.',
  img: '../../assets/photo-jacket-back.png'
}, {
  t: 'Patch & Badge Digitizing',
  d: 'Perfect for patches and badges.',
  img: '../../assets/photo-polo-black.png'
}, {
  t: 'Applique Digitizing',
  d: 'Fabric applique ready files.',
  img: '../../assets/photo-fabric-cz.png'
}, {
  t: 'Image to Embroidery',
  d: 'Turn any photo into embroidery.',
  img: '../../assets/photo-gold-stitch.png'
}];
const VEC = [{
  t: 'Logo Vectorization',
  d: 'Scalable & print ready.'
}, {
  t: 'Illustration Vector',
  d: 'Detailed & clean artwork.'
}, {
  t: 'Vector Conversion',
  d: 'Any file to vector.'
}, {
  t: 'SVG / EPS / PDF',
  d: 'Multiple formats.'
}];
function ServicesPage({
  go
}) {
  const [tab, setTab] = React.useState('Embroidery Digitizing');
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-navy)',
      padding: '40px 0 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: PAGE
  }, /*#__PURE__*/React.createElement(SectionHead, {
    tone: "navy",
    title: "Our Services",
    sub: "Professional solutions for all your embroidery and vector needs."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      padding: '22px 0 20px'
    }
  }, /*#__PURE__*/React.createElement(SegmentedToggle, {
    tone: "navy",
    options: ['Embroidery Digitizing', 'Vector Art'],
    value: tab,
    onChange: setTab
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...PAGE,
      padding: '36px 24px'
    }
  }, tab === 'Embroidery Digitizing' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: 6
    }
  }, "Embroidery Digitizing Services"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, "Turn your artwork into high-quality embroidery files with precision and care."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16,
      marginTop: 20
    }
  }, EMB.map(s => /*#__PURE__*/React.createElement(ServiceCard, {
    key: s.t,
    image: s.img,
    title: s.t,
    description: s.d
  })))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: 6
    }
  }, "Vector Art Services"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, "Clean, scalable vector files ready for print and production."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 16,
      marginTop: 20
    }
  }, VEC.map(s => /*#__PURE__*/React.createElement(ServiceCard, {
    key: s.t,
    title: s.t,
    description: s.d
  })))), /*#__PURE__*/React.createElement(Card, {
    tone: "gold",
    style: {
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 'var(--text-h4)',
      fontWeight: 700,
      color: 'var(--gold-700)'
    }
  }, "Need a Custom Design?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--gold-700)',
      marginTop: 3
    }
  }, "We also offer custom digitizing and vector art services.")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => go('Get a Quote')
  }, "Get a Quote")))), /*#__PURE__*/React.createElement(CtaBand, {
    go: go
  }));
}
Object.assign(window, {
  ServicesPage
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/ServicesPage.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/SiteChrome.jsx
try { (() => {
const {
  Logo,
  Eyebrow,
  IconTile,
  FeatureItem,
  FlagChip,
  Button,
  Input,
  Textarea,
  FormField,
  Card
} = window.CZDigitizingDesignSystem_765273;
const ASSETS = '../../assets';
const PAGE = {
  maxWidth: 1240,
  margin: '0 auto',
  padding: '0 24px'
};
function SectionHead({
  eyebrow,
  title,
  sub,
  align = 'left',
  tone = 'light'
}) {
  const onNavy = tone === 'navy';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: align,
      maxWidth: align === 'center' ? 680 : 'none',
      margin: align === 'center' ? '0 auto' : undefined
    }
  }, eyebrow ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: align === 'center' ? 'center' : 'flex-start'
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, eyebrow)) : null, /*#__PURE__*/React.createElement("h2", {
    style: {
      marginTop: eyebrow ? 8 : 0,
      color: onNavy ? 'var(--cz-white)' : 'var(--text-strong)'
    }
  }, title), sub ? /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 10,
      marginBottom: 0,
      fontSize: 'var(--text-md)',
      color: onNavy ? 'var(--text-on-navy-muted)' : 'var(--text-muted)'
    }
  }, sub) : null);
}
function TrustStrip() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-navy)',
      borderTop: '1px solid var(--border-on-navy)',
      borderBottom: '1px solid var(--border-on-navy)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...PAGE,
      display: 'flex',
      justifyContent: 'space-between',
      gap: 24,
      padding: '18px 24px'
    }
  }, /*#__PURE__*/React.createElement(FeatureItem, {
    icon: "award",
    title: "10 Years",
    sub: "of Experience"
  }), /*#__PURE__*/React.createElement(FeatureItem, {
    icon: "gem",
    title: "Top Quality",
    sub: "& Accuracy"
  }), /*#__PURE__*/React.createElement(FeatureItem, {
    icon: "clock",
    title: "Fast Turnaround",
    sub: "Time"
  }), /*#__PURE__*/React.createElement(FeatureItem, {
    icon: "globe",
    title: "Global",
    sub: "Clients"
  })));
}
function CtaBand({
  go
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-navy)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...PAGE,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 24,
      padding: '34px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
    style: {
      color: 'var(--cz-white)',
      fontSize: 'var(--text-h2)'
    }
  }, "Ready to Turn Your Artwork Into Perfect Stitches?"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '8px 0 0',
      fontSize: 'var(--text-sm)',
      color: 'var(--text-on-navy-muted)'
    }
  }, "Get a quote today and bring your ideas to life.")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    iconAfter: "arrow-right",
    onClick: () => go('Get a Quote')
  }, "Get a Quote")));
}
function ContactPage({
  go
}) {
  const CH = [['message-circle', 'WhatsApp', '+92 317 4604508', 'Chat with us'], ['mail', 'Email', 'czdigitizing@gmail.com', 'Send Email'], ['facebook', 'Facebook', 'CZ Digitizing', 'Follow us'], ['instagram', 'Instagram', '@czdigitizing', 'Follow us'], ['linkedin', 'LinkedIn', 'CZ Digitizing', 'Connect'], ['youtube', 'YouTube', 'CZ Digitizing', 'Subscribe']];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-navy)',
      padding: '44px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: PAGE
  }, /*#__PURE__*/React.createElement(SectionHead, {
    tone: "navy",
    eyebrow: "Get In Touch",
    title: "Contact Us",
    sub: "We'd love to hear from you. Get in touch with us anytime."
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...PAGE,
      padding: '40px 24px',
      display: 'grid',
      gridTemplateColumns: '1.1fr 1fr',
      gap: 24,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 12
    }
  }, CH.map(([ic, t, v, a]) => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      padding: 14,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-xs)'
    }
  }, /*#__PURE__*/React.createElement(IconTile, {
    icon: ic,
    size: 38,
    tone: "goldSoft"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 600,
      color: 'var(--text-strong)'
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xs)',
      color: 'var(--gold-600)',
      fontWeight: 600,
      marginTop: 4
    }
  }, a))))), /*#__PURE__*/React.createElement(Card, {
    title: "Send Us a Message"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(FormField, {
    label: "Name",
    required: true
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Your name"
  })), /*#__PURE__*/React.createElement(FormField, {
    label: "Email",
    required: true
  }, /*#__PURE__*/React.createElement(Input, {
    icon: "mail",
    placeholder: "you@company.com"
  })), /*#__PURE__*/React.createElement(FormField, {
    label: "Message",
    required: true
  }, /*#__PURE__*/React.createElement(Textarea, {
    rows: 5,
    placeholder: "Tell us about your design\u2026"
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    block: true
  }, "Send Message")))), /*#__PURE__*/React.createElement(CtaBand, {
    go: go
  }));
}
function SiteFooter() {
  const COUNTRIES = [['US', 'USA'], ['GB', 'UK'], ['CA', 'Canada'], ['AU', 'Australia'], ['DE', 'Germany'], ['AE', 'UAE'], ['SA', 'Saudi Arabia'], ['FR', 'France']];
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: 'var(--navy-900)',
      borderTop: '1px solid var(--border-on-navy)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...PAGE,
      padding: '28px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 24,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Logo, {
    variant: "dark",
    height: 46,
    assetBase: ASSETS
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 26,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(FeatureItem, {
    icon: "award",
    title: "10 Years",
    sub: "of Experience"
  }), /*#__PURE__*/React.createElement(FeatureItem, {
    icon: "message-circle",
    title: "WhatsApp",
    sub: "+92 317 4604508"
  }), /*#__PURE__*/React.createElement(FeatureItem, {
    icon: "mail",
    title: "Email",
    sub: "czdigitizing@gmail.com"
  }), /*#__PURE__*/React.createElement(FeatureItem, {
    icon: "globe",
    title: "Global Reach",
    sub: "Worldwide Customers"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontStyle: 'italic',
      fontSize: 22,
      color: 'var(--gold-500)',
      lineHeight: 1.2,
      textAlign: 'right'
    }
  }, "Together", /*#__PURE__*/React.createElement("br", null), "We Create")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      paddingTop: 16,
      borderTop: '1px solid var(--border-on-navy)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 20,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      flexWrap: 'wrap'
    }
  }, COUNTRIES.map(([c, l]) => /*#__PURE__*/React.createElement(FlagChip, {
    key: c,
    flag: c,
    label: l
  }))), /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "onNavy"
  }, "Inspire \u2022 Digitize \u2022 Stitch"))));
}
Object.assign(window, {
  PAGE,
  ASSETS,
  SectionHead,
  TrustStrip,
  CtaBand,
  ContactPage,
  SiteFooter
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/SiteChrome.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.GoldRule = __ds_scope.GoldRule;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconTile = __ds_scope.IconTile;

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.Accordion = __ds_scope.Accordion;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Pagination = __ds_scope.Pagination;

__ds_ns.SegmentedToggle = __ds_scope.SegmentedToggle;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.ActivityRow = __ds_scope.ActivityRow;

__ds_ns.BarChart = __ds_scope.BarChart;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.DonutStat = __ds_scope.DonutStat;

__ds_ns.LineChart = __ds_scope.LineChart;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.FileField = __ds_scope.FileField;

__ds_ns.FormField = __ds_scope.FormField;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.SearchField = __ds_scope.SearchField;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.CreditPack = __ds_scope.CreditPack;

__ds_ns.FeatureItem = __ds_scope.FeatureItem;

__ds_ns.FlagChip = __ds_scope.FlagChip;

__ds_ns.PricingCard = __ds_scope.PricingCard;

__ds_ns.ServiceCard = __ds_scope.ServiceCard;

__ds_ns.TestimonialCard = __ds_scope.TestimonialCard;

__ds_ns.SidebarNav = __ds_scope.SidebarNav;

__ds_ns.SiteHeader = __ds_scope.SiteHeader;

__ds_ns.TopBar = __ds_scope.TopBar;

})();
