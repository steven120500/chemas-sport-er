import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { FaUser } from 'react-icons/fa';
import { FiLogOut, FiUserPlus, FiUsers } from 'react-icons/fi';

export default function UserDropdown({ isSuperUser, onLogout, onAddUser, onViewUsers }) {
  return (
    <div className="relative">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="rounded-full bg-green-500 p-3 text-white hover:bg-green-600 absolute top-6 right-4 z-50"
            aria-label="User menu"
          >
            <FaUser size={20} />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Content
          sideOffset={8}
          className="bg-white border rounded shadow-lg p-2 text-sm space-y-1 z-50"
        >
          {isSuperUser && (
            <>
              <DropdownMenu.Item
                className="cursor-pointer flex items-center gap-2 hover:bg-gray-100 p-2 rounded"
                onSelect={(e) => {
                  e.preventDefault();
                  document.dispatchEvent(new KeyboardEvent("keydown",{key: "Escape"}))
                    onAddUser();
                  
                  
                }}
              >
                <FiUserPlus /> Agregar usuario
              </DropdownMenu.Item>

              <DropdownMenu.Item
                className="cursor-pointer flex items-center gap-2 hover:bg-gray-100 p-2 rounded"
                onSelect={(e) => {
                  e.preventDefault();
                  document.dispatchEvent(new KeyboardEvent("keydown",{key: "Escape"}))
                  onViewUsers();
                }}
              >
                <FiUsers /> Ver usuarios
              </DropdownMenu.Item>
            </>
          )}

          <DropdownMenu.Item
            className="cursor-pointer flex items-center gap-2 hover:bg-gray-100 p-2 rounded"
            onClick={(e) => {
              e.preventDefault();
              onLogout();
            }}
          >
            <FiLogOut /> Cerrar sesión
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}