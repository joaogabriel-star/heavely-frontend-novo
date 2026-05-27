import '../components/Input.jsx';

export const Input = ({ label, type = 'text', placeholder, value, onChange, required }) => {
  return (
    <div className="field">
      <label>
        {label}
        {required && <span className="required">*</span>}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
      />
    </div>
  );
};