import { useEffect, useState } from "react";
import { useParams,useNavigate } from "react-router-dom";
import { dummyDateTimeData, dummyShowsData } from "../assets/assets";
import { Heart, PlayCircleIcon, StarIcon } from "lucide-react";
import timeFormat from "../lib/timeFormat";
import BlurCircle from "../components/BlurCircle";
import DateSelect from "../components/DateSelect";
import MovieCard from "../components/MovieCard";
import Loading from "../components/Loading";

const MovieDetails = () => {
  const { id } = useParams();
  const [show, setShow] = useState(null);
  const [error, setError] = useState("");
 const navigate = useNavigate(); 
  useEffect(() => {
    const getShow = async () => {
      if (!id) {
        setError("No movie ID provided.");
        return;
      }

      const foundShow = dummyShowsData.find((show) => show._id === id);

      if (foundShow) {
        const dateTimeData = dummyDateTimeData

        setShow({ movie: foundShow, dateTime: dateTimeData });
        setError("");
      } else {
        setError("Movie not found.");
        setShow(null);
        <Loading />
      }
    };

    getShow();
  }, [id]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <h1 className="text-xl font-semibold text-red-400 text-center">{error}</h1>
      </div>
    );
  }

  if (!show) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <h1 className="text-xl font-semibold text-gray-200 text-center">Loading...</h1>
      </div>
    );
  }

  const { movie } = show;

  return (
    <div className="px-6 md:px-16 lg:px-40 pt-30 md:pt-50">
      <div className="flex flex-col md:flex-row gap-8 max-w-6xl mx-auto">
        <img
          src={movie.poster_path ?? "/fallback.jpg"}
          alt={movie.title}
          className="max-md:mx-auto rounded-xl h-104 max-w-70 object-cover shadow-2xl border-4 border-gray-800"
        />
        <div className="relative flex flex-col gap-3">
          <BlurCircle top="-100px" left="-100px" />
          <p className="text-primary">ENGLISH</p>
          <h1 className="text-4xl font-semibold max-w-96 text-balance">
            {movie.title}
          </h1>
          <div className="flex items-center gap-2 text-gray-300">
            <StarIcon className="w-5 h-5 text-primary fill-primary" />
            <span className="text-sm">
              {movie.vote_average?.toFixed(1) ?? "N/A"} User Ratings
            </span>
          </div>
          <p className="text-gray-400 mt-2 text-sm leading-tight max-w-xl">
            {movie.overview ?? "No description available."}
          </p>
          <p className="text-gray-300 text-sm">
            {timeFormat(movie.runtime) ?? "N/A"} •{" "}
            {movie.release_date
              ? new Date(movie.release_date).getFullYear()
              : "N/A"}
          </p>
          <div className="flex items-center gap-4 mt-4">
            <button className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white font-semibold rounded-lg shadow-lg hover:scale-105 hover:from-blue-600 hover:to-pink-600 transition-all duration-200"
              style={{
                boxShadow: "0 4px 14px 0 rgba(103, 58, 183, 0.15)",
                letterSpacing: "0.03em",
              }}
            >
              <PlayCircleIcon className="w-5 h-5 mr-1" />
              Watch Trailer
            </button>
            <a
              href="#dateSelect"
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white font-semibold rounded-lg shadow-lg hover:scale-105 hover:from-pink-600 hover:to-yellow-600 transition-all duration-200"
              style={{
                boxShadow: "0 4px 14px 0 rgba(255, 87, 34, 0.15)",
                letterSpacing: "0.03em",
              }}
            >
              <svg
                className="w-5 h-5 mr-1"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 9V7a5 5 0 00-10 0v2M5 11h14l-1.38 8.32A2 2 0 0115.64 21H8.36a2 2 0 01-1.98-1.68L5 11zm2 0V7a3 3 0 016 0v4"
                />
              </svg>
              Buy Tickets
            </a>
            <button
              className="ml-2 p-2 rounded-full bg-gradient-to-tr from-pink-600 via-red-500 to-yellow-400 shadow-lg hover:scale-110 transition-all duration-200 group"
              style={{
                boxShadow: "0 2px 8px 0 rgba(255, 87, 34, 0.18)",
              }}
              aria-label="Add to favorites"
            >
              <Heart className="w-6 h-6 text-white group-hover:fill-red-400 transition-all duration-200" fill="#f87171" />
            </button>
          </div>
          {Array.isArray(movie.genres) && (
            <div className="flex gap-2 flex-wrap mt-2">
              {movie.genres.slice(0, 2).map((genre, idx) => (
                <span
                  key={genre.name}
                  className={`flex items-center gap-1 px-3 py-1 text-xs rounded-full shadow-md border font-medium
                    ${idx % 2 === 0
                      ? "bg-green-700 border-green-400/30 text-green-100"
                      : "bg-orange-700 border-orange-400/30 text-orange-100"
                    }
                  `}
                  style={{
                    background: idx % 2 === 0
                      ? "linear-gradient(90deg, #059669 0%, #10b981 100%)"
                      : "linear-gradient(90deg, #ea580c 0%, #f59e42 100%)"
                  }}
                >
                  <svg
                    className="w-4 h-4 text-yellow-300 drop-shadow"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <circle cx="10" cy="10" r="8" opacity="0.15" />
                    <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14.5A6.5 6.5 0 1110 3.5a6.5 6.5 0 010 13z" />
                  </svg>
                  {genre.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <h2 className="mt-14 mb-6 text-2xl font-bold text-gray-200 text-center">
        Your Favourite Cast
      </h2>
      <div className="overflow-x-auto no-scrollbar mt-8 pb-4">
        <div className="flex items-center gap-6 w-max px-4">
          {show.movie.casts.slice(0, 12).map((cast, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-2"
            >
              <img
                src={cast.profile_path ?? "/fallback.jpg"}
                alt={cast.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-pink-400"
                style={{
                  objectFit: "cover",
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%"
                }}
              />
              <p className="text-sm font-semibold text-gray-100 text-center leading-tight">{cast.name}</p>
              <p className="text-xs text-pink-300 text-center italic">{cast.character}</p>
            </div>
          ))}
        </div>
      </div>
      <DateSelect dateTime={show.dateTime} id={movie._id} />
      <p className="text-lg font-medium mt-20 mb-8">
        You may also like
      </p>
      <div className="flex flex-wrap max-sm:justify-center gap-8 ">
        {dummyShowsData.slice(0, 4).map((movie, index) => (
          <MovieCard key={index} movie={movie} />
        ))}
      </div>
      <div className="flex justify-center mt-20">
        <button onClick={() => {navigate(`/movies`); scrollTo(0,0)}} className='px-10 py-3 text-sm bg-primary hover:bg-primary-dull transition rounded-md font-medium cursor-pointer'>
          Show more
        </button>
      </div>
    </div>
  );
};

export default MovieDetails;
