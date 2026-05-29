import { Text } from "@/lib/theme";
const  DropArrow = () => {
    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        style={{ flexShrink: 0, opacity: 0.35 }}
      >
        <path
          d="M4 2l4 4-4 4"
          stroke={Text.accent}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  export default DropArrow;