import React, { useEffect, useState } from 'react';
import { dummyBookingData } from '../../assets/assets';
import Title from '../../components/admin/Title';
import { dateFormat } from '../../lib/DateFormat';

const ListBookings = () => {
  const currency = import.meta.env.VITE_CURRENCY || '₹';

  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const getAllBookings = async () => {
    setBookings(dummyBookingData); // Simulated fetch
    setIsLoading(false);
  };

  useEffect(() => {
    getAllBookings();
  }, []);

  return !isLoading ? (
    <>
      <Title text1="List" text2="Bookings" />
      <div className="max-w-4xl mt-6 overflow-x-auto">
        <table className="w-full border-collapse rounded-md overflow-hidden whitespace-nowrap">
          <thead>
            <tr className="bg-primary/20 text-left text-white">
              <th className="p-2 font-medium pl-5">👤 User Name</th>
              <th className="p-2 font-medium">🎬 Movie Name</th>
              <th className="p-2 font-medium">🕒 Show Time</th>
              <th className="p-2 font-medium">💺 Seats</th>
              <th className="p-2 font-medium">💰 Amount</th>
            </tr>
          </thead>
          <tbody className="text-sm font-light">
            {bookings.map((item, index) => (
              <tr key={index} className="border-b border-primary/20 bg-primary/5 even:bg-primary/10">
                <td className="p-2 min-w-45 pl-5">{item.user.name}</td>
                <td className="p-2">{item.show.movie.title}</td>
                <td className="p-2">{dateFormat(item.show.showDateTime)}</td>
                <td className="p-2">{Object.values(item.bookedSeats).join(', ')}</td>
                <td className="p-2">{currency}{item.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  ) : (
    <div className="text-center mt-10 text-lg text-gray-400">Loading Bookings...</div>
  );
};

export default ListBookings;
