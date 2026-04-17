import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

function DistrictItem({ district, areas, deleteDistrict, deleteArea }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-t">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full text-left p-4 hover:bg-gray-100">
                <div className="flex justify-between items-center">
                    <span className="font-semibold pl-4">{district.name}</span>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">{areas.length} areas</span>
                        <button className="text-sm text-blue-500">Edit</button>
                        <button
                            onClick={() => deleteDistrict(district.id)}
                            className="text-sm text-red-500"
                        >
                            Delete
                        </button>
                        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                </div>
            </button>
            {isOpen && (
                <div className="pl-8 bg-gray-100/50">
                    {areas.length > 0 ? (
                        areas.map(area => (
                            <div key={area.id} className="p-3 border-t text-sm flex justify-between items-center">
                                <span>{area.name}</span>
                                <div className="flex items-center gap-4">
                                    <button className="text-sm text-blue-500">Edit</button>
                                    <button
                                        onClick={() => deleteArea(area.id)}
                                        className="text-sm text-red-500"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-3 text-sm text-gray-500">No areas found for this district.</div>
                    )}
                </div>
            )}
        </div>
    )
}                        
                        
                        export default function LocationSettings() {
                        const [districts, setDistricts] = useState([]);
                        const [areas, setAreas] = useState({});
                        const [loading, setLoading] = useState(true);
                        const [isModalOpen, setIsModalOpen] = useState(false);
                        
                        const fetchLocations = async () => {
                        setLoading(true);
                        try {
                          const { data: districtsData, error: districtsError } = await supabase
                            .from("districts")
                            .select("*")
                            .order("name");
                          if (districtsError) throw districtsError;
                          setDistricts(districtsData || []);
                        
                          const { data: areasData, error: areasError } = await supabase
                            .from("areas")
                            .select("*")
                            .order("name");
                          if (areasError) throw areasError;
                        
                          const areasByDistrict = (areasData || []).reduce((acc, area) => {
                            if (!acc[area.district_id]) {
                              acc[area.district_id] = [];
                            }
                            acc[area.district_id].push(area);
                            return acc;
                          }, {});
                          setAreas(areasByDistrict);
                        
                        } catch (error) {
                          console.error("Error fetching locations:", error);
                          // Maybe show an error state in the UI
                        } finally {
                          setLoading(false);
                        }
                        };
                        
                        const deleteArea = async (areaId) => {
                            try {
                                const { error } = await supabase
                                    .from('areas')
                                    .delete()
                                    .eq('id', areaId);
                                if (error) throw error;
                                fetchLocations();
                            } catch (error) {
                                console.error('Error deleting area:', error);
                            }
                        };
                        
                        const deleteDistrict = async (districtId) => {
                        try {
                            const { error: areaError } = await supabase
                                .from('areas')
                                .delete()
                                .eq('district_id', districtId);
                            if (areaError) throw areaError;
                        
                            const { error: districtError } = await supabase
                                .from('districts')
                                .delete()
                                .eq('id', districtId);
                            if (districtError) throw districtError;
                        
                            fetchLocations();
                        } catch (error) {
                            console.error('Error deleting district:', error);
                        }
                        };                        
                        useEffect(() => {
                        fetchLocations();
                        }, []);

  if (loading) {
    return <div className="p-6 text-gray-500">Loading locations...</div>;
  }

  return (
    <div className="bg-card rounded-xl border">
      <div className="p-6 border-b">
        <h2 className="text-lg font-bold">
          Location Hierarchy
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          View configured districts and areas
        </p>
        <div className="mt-4">
            <button
                onClick={() => setIsModalOpen(true)}
                className="bg-primary text-white px-4 py-2 rounded-md"
            >
                Add Location
            </button>
        </div>
      </div>
      <div>
        {districts.map(district => (
          <DistrictItem key={district.id} district={district} areas={areas[district.id] || []} deleteDistrict={deleteDistrict} deleteArea={deleteArea} />
        ))}
        {districts.length === 0 && (
            <div className="p-6 text-center text-gray-500">No districts found.</div>
        )}
      </div>
        {isModalOpen && <AddLocationModal onClose={() => setIsModalOpen(false)} fetchLocations={fetchLocations} />}
    </div>
  );
}

function AddLocationModal({ onClose, fetchLocations }) {
    const [district, setDistrict] = useState('');
    const [area, setArea] = useState('');

    const handleSave = async () => {
        try {
            let districtId;
            const { data: existingDistrict, error: districtError } = await supabase
                .from('districts')
                .select('id')
                .eq('name', district)
                .single();

            if (districtError && districtError.code !== 'PGRST116') {
                throw districtError;
            }

            if (existingDistrict) {
                districtId = existingDistrict.id;
            } else {
                const { data: newDistrict, error: newDistrictError } = await supabase
                    .from('districts')
                    .insert({ name: district })
                    .select('id')
                    .single();
                if (newDistrictError) {
                    throw newDistrictError;
                }
                districtId = newDistrict.id;
            }

            const { error: areaError } = await supabase
                .from('areas')
                .insert({ name: area, district_id: districtId });

            if (areaError) {
                throw areaError;
            }

            fetchLocations();
            onClose();
        } catch (error) {
            console.error('Error saving location:', error);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-card rounded-lg p-8">
                <h2 className="text-lg font-bold mb-4">Add Location</h2>
                <div className="flex flex-col gap-4">
                    <input
                        type="text"
                        placeholder="District"
                        value={district}
                        onChange={(e) => setDistrict(e.target.value)}
                        className="border border-gray-300 rounded-md p-2"
                    />
                    <input
                        type="text"
                        placeholder="Area"
                        value={area}
                        onChange={(e) => setArea(e.target.value)}
                        className="border border-gray-300 rounded-md p-2"
                    />
                </div>
                <div className="flex justify-end gap-4 mt-4">
                    <button
                        onClick={onClose}
                        className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="bg-primary text-white px-4 py-2 rounded-md"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}
