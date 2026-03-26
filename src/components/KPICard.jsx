import styles from './KPICard.module.css';

export default function KPICard({ label, value, small }) {
  return (
    <div className={styles.card}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ${small ? styles.valueSmall : ''}`}>{value}</span>
    </div>
  );
}
