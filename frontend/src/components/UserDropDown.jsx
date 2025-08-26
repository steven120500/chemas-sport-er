// src/components/UserDropDown.jsx
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { FaUser } from 'react-icons/fa';
import { FiLogOut, FiUserPlus, FiUsers, FiClock } from 'react-icons/fi';

export default function UserDropdown({
  isSuperUser,        // boolean
  canSeeHistory,      // boolean -> super o rol 'history'
  onLogout,           // () => void
  onAddUser,          // () => void
  onViewUsers,        // () => void
  onViewHistory,      // () => void
}) {
  // util para cerrar el menú en móviles al hacer click
  const closeMenu = () =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

  return (
    <div className="relative">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="rounded-full mt-4 p-3 shadow-lg transition bg-green-500 text-white bg-black hover:bg-gray-800"
            aria-label="User menu"
          >
            <FaUser size={20} />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Content
          sideOffset={8}
          className="bg-white border rounded shadow-lg p-2 text-sm space-y-1 z-50"
        >
          {/* Opciones solo para súper */}
          {isSuperUser && (
            <>
              <DropdownMenu.Item
                className="cursor-pointer flex items-center gap-2 hover:bg-gray-100 p-2 rounded"
                onSelect={(e) => { e.preventDefault(); closeMenu(); onAddUser(); }}
              >
                <FiUserPlus /> Agregar usuario
              </DropdownMenu.Item>

              <DropdownMenu.Item
                className="cursor-pointer flex items-center gap-2 hover:bg-gray-100 p-2 rounded"
                onSelect={(e) => { e.preventDefault(); closeMenu(); onViewUsers(); }}
              >
                <FiUsers /> Ver usuarios
              </DropdownMenu.Item>
            </>
          )}

          {/* Historial: súper o rol 'history' */}
          {canSeeHistory && (
            <DropdownMenu.Item
              className="cursor-pointer flex items-center gap-2 hover:bg-gray-100 p-2 rounded"
              onSelect={(e) => { e.preventDefault(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); onViewHistory(); }}
            >
              <FiClock /> Historial
            </DropdownMenu.Item>
          )}

          {/* Cerrar sesión */}
          <DropdownMenu.Item
            className="cursor-pointer flex items-center gap-2 hover:bg-gray-100 p-2 rounded"
            onSelect={(e) => { e.preventDefault(); closeMenu(); onLogout(); }}
          >
            <FiLogOut /> Cerrar sesión
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  );
}