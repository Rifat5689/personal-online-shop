import { useState } from "react";
import { TbSearch } from "react-icons/tb";
import SearchSuggestions from "./SearchSuggestions";

const FloatingSearchBar = ({
  isVisible = false,
  searchValue = "",
  onSearchChange,
  suggestions = [],
  onSuggestionSelect,
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className={`fixed inset-x-0 top-0 z-50 transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="border-b border-[#5a1f7a]/10 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-2">
          <div className="relative">
            <div className="flex items-center gap-2 rounded-full bg-[#f7f2fd] px-4 py-2 text-sm text-[#1b1a4a] shadow-sm">
              <TbSearch className="h-4 w-4 text-[#5a1f7a]" aria-hidden="true" />
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Search products..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#5a1f7a]/60"
                aria-label="Search products"
              />
            </div>
            <SearchSuggestions
              isOpen={focused && !!searchValue.trim()}
              suggestions={suggestions}
              onSelect={onSuggestionSelect}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FloatingSearchBar;
