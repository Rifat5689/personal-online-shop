import { TbSearch } from "react-icons/tb";

const SearchSuggestions = ({ isOpen, suggestions, onSelect }) => {
  if (!isOpen || !suggestions.length) return null;
  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[#f0cfe0] bg-white shadow-lg">
      <div className="max-h-64 overflow-auto py-2">
        {suggestions.map((s) => (
          <button
            key={s.id ?? s.name}
            type="button"
            onMouseDown={() => onSelect(s)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#2a1b2e] hover:bg-[#fdf2f7]"
          >
            <TbSearch className="h-4 w-4 text-[#c04b78]" aria-hidden="true" />
            <span className="truncate">{s.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchSuggestions;
