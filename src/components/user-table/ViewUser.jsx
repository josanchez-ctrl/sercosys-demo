import { User } from 'lucide-react'; // Asumiendo lucide-react por tu stack

const ViewUser = ({ textDisplay, usuario, timestamp, formatDate }) => {
    if (!usuario || !timestamp) return null;

    return (
        <div className="flex flex-col items-start text-[11px] font-bold text-slate-800 uppercase tracking-tight border-l-4 border-brand-400 pl-2">
            <span className="text-[9px] font-bold text-slate-400">{textDisplay}:</span>
            <span className="flex flex-row items-center">
                <span className="flex items-center gap-2">
                    <User size={10} />
                </span>
                <span className="whitespace-nowrap flex flex-col items-center overflow-hidden text-ellipsis">
                    {usuario.nombres} {usuario.apellidos}
                    <span className="w-full ml-6 text-[9px] font-bold text-slate-400">
                        {formatDate(timestamp)}
                    </span>
                </span>
            </span>
        </div>
    );
};

export default ViewUser;