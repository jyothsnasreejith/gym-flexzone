// 🟦 BLUE DARK GYM DESIGN SYSTEM - Component Snippets
// Copy and paste these components directly into your JSX files

// ===== STAT CARD (Most Common) =====
export function StatCard({ icon, title, value, change }) {
  return (
    <div className="gym-card">
      <div className="card-icon">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <h3 className="card-title">{title}</h3>
      <div className="card-value">{value}</div>
      <p className="card-meta">{change}</p>
    </div>
  );
}

// Usage:
// <StatCard 
//   icon="trending_up" 
//   title="Revenue" 
//   value="$45K" 
//   change="+12% this month" 
// />

// ===== STAT CARD WITH CHART =====
export function StatCardWithChart({ icon, title, value, change, children }) {
  return (
    <div className="gym-card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="card-icon mb-3">
            <span className="material-symbols-outlined">{icon}</span>
          </div>
          <h3 className="card-title">{title}</h3>
          <div className="card-value">{value}</div>
          <p className="card-meta">{change}</p>
        </div>
      </div>
      <div className="gym-divider my-4"></div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

// ===== PRIMARY BUTTON =====
export function PrimaryButton({ onClick, children, disabled = false }) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

// ===== SECONDARY BUTTON =====
export function SecondaryButton({ onClick, children, disabled = false }) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

// ===== BUTTON GROUP =====
export function ButtonGroup({ buttons }) {
  return (
    <div className="flex gap-3 flex-wrap">
      {buttons.map((btn, i) => (
        <button 
          key={i}
          onClick={btn.onClick}
          className={btn.variant === 'secondary' ? 'btn-secondary' : 'btn-primary'}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}

// ===== STATUS BADGE =====
export function StatusBadge({ status, label }) {
  const badgeClass = {
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info'
  }[status] || 'badge-info';

  return <span className={badgeClass}>{label}</span>;
}

// Usage:
// <StatusBadge status="success" label="Active" />
// <StatusBadge status="warning" label="Pending" />
// <StatusBadge status="error" label="Inactive" />

// ===== INPUT FIELD =====
export function InputField({ label, placeholder, value, onChange, type = 'text' }) {
  return (
    <div className="space-y-2">
      {label && <label className="text-secondary text-sm font-medium">{label}</label>}
      <input 
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  );
}

// ===== FORM GROUP =====
export function FormGroup({ label, children }) {
  return (
    <div className="space-y-2">
      <label className="text-secondary text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

// ===== DASHBOARD GRID (4 COLUMNS) =====
export function DashboardGrid({ children }) {
  return (
    <div className="dashboard-grid p-6">
      {children}
    </div>
  );
}

// Usage:
// <DashboardGrid>
//   <StatCard icon="people" title="Members" value="1,254" change="+8%" />
//   <StatCard icon="trending_up" title="Revenue" value="$45K" change="+12%" />
// </DashboardGrid>

// ===== 3-COLUMN GRID =====
export function Grid3Column({ children }) {
  return (
    <div className="dashboard-grid-3 p-6">
      {children}
    </div>
  );
}

// ===== SECTION HEADER =====
export function SectionHeader({ title, subtitle }) {
  return (
    <div className="page-header">
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
  );
}

// ===== CARD WITH CONTENT =====
export function ContentCard({ title, children }) {
  return (
    <div className="gym-card">
      <h3 className="card-title font-bold mb-4">{title}</h3>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

// ===== DIVIDER WITH TEXT =====
export function DividerWithText({ text }) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="gym-divider flex-1"></div>
      <span className="text-muted text-sm">{text}</span>
      <div className="gym-divider flex-1"></div>
    </div>
  );
}

// ===== ALERT BOX =====
export function AlertBox({ type, title, message, onClose }) {
  const bgColor = {
    success: 'bg-success bg-opacity-10 border border-success',
    warning: 'bg-warning bg-opacity-10 border border-warning',
    error: 'bg-error bg-opacity-10 border border-error',
    info: 'bg-info bg-opacity-10 border border-info'
  }[type] || 'bg-info bg-opacity-10 border border-info';

  const textColor = {
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
    info: 'text-info'
  }[type] || 'text-info';

  return (
    <div className={`${bgColor} rounded-lg p-4 mb-4`}>
      <div className="flex justify-between items-start">
        <div>
          {title && <h4 className={`${textColor} font-bold`}>{title}</h4>}
          <p className={`${textColor} text-sm`}>{message}</p>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className={`${textColor} hover:opacity-70`}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ===== LOADING CARD =====
export function LoadingCard() {
  return (
    <div className="gym-card animate-pulse">
      <div className="h-8 bg-secondary-blue rounded mb-4"></div>
      <div className="h-12 bg-secondary-blue rounded mb-4"></div>
      <div className="h-4 bg-secondary-blue rounded w-2/3"></div>
    </div>
  );
}

// ===== MEMBER/USER CARD =====
export function UserCard({ name, email, role, avatar, status }) {
  return (
    <div className="gym-card">
      <div className="flex items-center gap-4">
        {avatar && (
          <img src={avatar} alt={name} className="w-12 h-12 rounded-lg" />
        )}
        <div className="flex-1">
          <h4 className="text-white font-bold">{name}</h4>
          <p className="text-secondary text-sm">{email}</p>
          <div className="flex gap-2 mt-2">
            <span className="text-muted text-xs">{role}</span>
            {status && <StatusBadge status={status} label="Active" />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== COMPLETE DASHBOARD PAGE =====
export function DashboardPage() {
  return (
    <div className="app-container">
      <SectionHeader 
        title="Gym Dashboard" 
        subtitle="Monitor your gym operations"
      />

      <DashboardGrid>
        <StatCard 
          icon="people" 
          title="Total Members" 
          value="1,254" 
          change="+8% this month" 
        />
        <StatCard 
          icon="trending_up" 
          title="Revenue" 
          value="$45K" 
          change="+12% from last month" 
        />
        <StatCard 
          icon="fitness_center" 
          title="Active Sessions" 
          value="42" 
          change="Currently active" 
        />
        <StatCard 
          icon="warning" 
          title="Expiring Soon" 
          value="18" 
          change="Need renewal" 
        />
      </DashboardGrid>

      <div className="p-6 space-y-4">
        <SectionHeader title="Quick Actions" />
        <ButtonGroup 
          buttons={[
            { label: 'Add New Member', variant: 'primary', onClick: () => {} },
            { label: 'View Reports', variant: 'secondary', onClick: () => {} },
            { label: 'Settings', variant: 'secondary', onClick: () => {} }
          ]}
        />
      </div>
    </div>
  );
}

// ===== EXPORT ALL COMPONENTS =====
export default {
  StatCard,
  StatCardWithChart,
  PrimaryButton,
  SecondaryButton,
  ButtonGroup,
  StatusBadge,
  InputField,
  FormGroup,
  DashboardGrid,
  Grid3Column,
  SectionHeader,
  ContentCard,
  DividerWithText,
  AlertBox,
  LoadingCard,
  UserCard,
  DashboardPage
};
