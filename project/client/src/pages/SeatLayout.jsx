import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dummyShowsData, dummyDateTimeData } from '../assets/assets';
import { ArrowRightIcon, ClockIcon } from 'lucide-react';
import isoTimeFormat from '../lib/isoTimeFormat';
import BlurCircle from '../components/BlurCircle';
import { assets } from '../assets/assets';
import { toast } from 'react-hot-toast';

const SeatLayout = () => {
    const groupRows = [["A", "B"], ["C", "D"], ["E", "F"], ["G", "H"], ["I", "J"]];

    const { id } = useParams();
    const [show, setShow] = useState(null);
    const [date, setDate] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);
    const [selectedSeats, setSelectedSeats] = useState([]);
    const navigate = useNavigate();

    const getShow = async () => {
        const show = dummyShowsData.find((show) => show._id === id);
        if (show) {
            setShow({
                show: show,
                dateTime: dummyDateTimeData,
            });
            if (dummyDateTimeData && Object.keys(dummyDateTimeData).length > 0) {
                setDate(Object.keys(dummyDateTimeData)[0]);
            }
        } else {
            console.error("Show not found");
            navigate('/movies');
        }
    };

    const handleSeatClick = (seatId) => {
        if (!selectedTime) {
            return toast("Please select time first");
        }
        if (!selectedSeats.includes(seatId) && selectedSeats.length >= 5) {
            return toast("You can only select 5 seats");
        }
        setSelectedSeats(prev =>
            prev.includes(seatId)
                ? prev.filter(seat => seat !== seatId)
                : [...prev, seatId]
        );
    };

    const renderSeats = (row, count = 9) => (
        <div key={row} className="flex gap-2 mt-2">
            <div className="flex flex-wrap items-center justify-center gap-2">
                {Array.from({ length: count }, (_, i) => {
                    const seatId = `${row}${i + 1}`;
                    return (
                        <button
                            key={seatId}
                            onClick={() => handleSeatClick(seatId)}
                            className={`h-8 w-8 rounded border border-primary-60 cursor-pointer 
                ${selectedSeats.includes(seatId) ? "bg-primary text-white" : ""}`}
                        >
                            {seatId}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    useEffect(() => {
        getShow();
        // eslint-disable-next-line
    }, []);

    return show && date ? (
        <div>
            {/* Sidebar Timings */}
            <div className="flex flex-col md:flex-row px-6 md:px-16 lg:px-40 py-30 md:pt-50">
                <div className="w-60 bg-primary/10 border border-primary/20 rounded-lg py-10 h-max md:sticky md:top-30">
                    <p className="text-lg font-semibold px-6">Available Timings</p>
                    <div className="mt-5 space-y-1">
                        {show.dateTime[date].map((item) => (
                            <div
                                key={item.time}
                                className={`flex items-center gap-2 px-6 py-2 w-max rounded-r-md cursor-pointer transition 
                  ${selectedTime?.time === item.time ? "bg-primary text-white" : "hover:bg-primary/20"}`}
                                onClick={() => setSelectedTime(item)}
                            >
                                <ClockIcon className="w-4 h-4" />
                                <p className="text-sm">{isoTimeFormat(item.time)}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Seat Layout */}
                <div className='relative flex-1 flex flex-col items-center max-md:mt-16'>
                    <BlurCircle top="-100px" left="-100px" />
                    <BlurCircle bottom="0" right="0" />
                    <h1 className='text-2xl font-semibold mb-4'>Select your seat</h1>
                    <img src={assets.screenImage} alt="screen" />
                    <p className='text-gray-400 text-sm mb-6'>SCREEN SIDE</p>

                    <div className="flex flex-col items-center mt-10 text-xs text-gray-300">
                        {/* Top A-B Rows */}
                        <div className='grid grid-cols-2 md:grid-cols-1 gap-8 md:gap-2 mb-6'>
                            {groupRows[0].map(row => renderSeats(row))}
                        </div>

                        {/* Remaining Rows C-J */}
                        <div className='grid grid-cols-2 gap-11'>
                            {groupRows.slice(1).map((group, idx) => (
                                <div key={idx} className="flex flex-col gap-2">
                                    {group.map(row => renderSeats(row))}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className=''>
                        <button onClick={() => navigate('/my-bookings')} className='flex items-center gap-1 mt-20 px-10 py-3 text-sm bg-primary hover:bg-primary-dull transition rounded-full font-medium cursor-pointer active:scale-95'>
                            Proceed to Checkout
                            <ArrowRightIcon strokeWidth={3} className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    ) : (
        <>
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-primary text-lg font-semibold">Loading...</p>
            </div>
            <div>
                <h1 className='text-xl font-semibold text-gray-200 text-center'>No movie Available</h1>
            </div>
        </>
    );
};

export default SeatLayout;
