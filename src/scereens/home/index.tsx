import { ColorSwatch, Group } from "@mantine/core";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import Draggable from "react-draggable";
import { SWATCHES } from "@/constants";

interface GeneratedResult {
  expression: string;
  answer: string;
}

interface Response {
  expr: string;
  result: string;
  assign: boolean;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("rgb(255, 255, 255)");
  const [reset, setReset] = useState(false);
  const [dictOfVars, setDictOfVars] = useState({});
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [latexPosition, setLatexPosition] = useState({ x: 10, y: 200 });
  const [latexExpressions, setLatexExpressions] = useState<Array<string>>([]);

  useEffect(() => {
    if (latexExpressions.length > 0 && window.MathJax) {
      setTimeout(() => {
        window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
      }, 0);
    }
  }, [latexExpressions]);

  useEffect(() => {
    if (reset) {
      resetCanvas();
      setLatexExpressions([]);
      setResults([]);
      setDictOfVars({});
      setReset(false);
    }
  }, [reset]);

  useEffect(() => {
    console.log(results);
    const canvas = canvasRef.current;

    if (canvas) {
      canvas.style.background = "black";
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - canvas.offsetTop;
        ctx.lineCap = "round";
        ctx.lineWidth = 3;
      }
    }

    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.9/MathJax.js?config=TeX-MML-AM_CHTML";
    script.async = true;
    document.head.appendChild(script);

    script.onload = () => {
      window.MathJax.Hub.Config({
        tex2jax: {
          inlineMath: [
            ["$", "$"],
            ["\\(", "\\)"],
          ],
        },
      });
    };

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Prevent pull-to-refresh on mobile
      const preventPullToRefresh = (e: TouchEvent) => {
        if (e.touches.length === 1) e.preventDefault();
      };

      canvas.addEventListener("touchstart", preventPullToRefresh, {
        passive: false,
      });
      canvas.addEventListener("touchmove", preventPullToRefresh, {
        passive: false,
      });

      return () => {
        canvas.removeEventListener("touchstart", preventPullToRefresh);
        canvas.removeEventListener("touchmove", preventPullToRefresh);
      };
    }
  }, []);

  const renderLatexToCanvas = (expression: string, answer: string) => {
    const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
    setLatexExpressions((prevExpressions) => [...prevExpressions, latex]);
  };

  const resetCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        setIsDrawing(true);

        const offsetX =
          "touches" in e
            ? e.touches[0].clientX - canvas.offsetLeft
            : e.nativeEvent.offsetX;
        const offsetY =
          "touches" in e
            ? e.touches[0].clientY - canvas.offsetTop
            : e.nativeEvent.offsetY;

        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);
      }
    }
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const offsetX =
          "touches" in e
            ? e.touches[0].clientX - canvas.offsetLeft
            : e.nativeEvent.offsetX;
        const offsetY =
          "touches" in e
            ? e.touches[0].clientY - canvas.offsetTop
            : e.nativeEvent.offsetY;

        ctx.lineTo(offsetX, offsetY);
        ctx.strokeStyle = color;
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const runRoute = async () => {
    const canvas = canvasRef.current;

    if (canvas) {
      const response = await axios({
        method: "post",
        url: `${import.meta.env.VITE_API_URL}/calculate`,
        data: {
          image: canvas.toDataURL("image/png"),
          dict_of_vars: dictOfVars,
        },
      });

      const resp = await response.data;

      resetCanvas();
      setResults([]);
      setLatexExpressions([]);

      resp.data.forEach((data: Response) => {
        if (data.assign === true) {
          setDictOfVars((prevDict) => ({
            ...prevDict,
            [data.expr]: data.result,
          }));
        }

        setResults((prevResults) => [
          ...prevResults,
          { expression: data.expr, answer: data.result },
        ]);

        renderLatexToCanvas(data.expr, data.result);
      });

      const ctx = canvas.getContext("2d");
      const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
      let minX = canvas.width,
        minY = canvas.height,
        maxX = 0,
        maxY = 0;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          if (imageData.data[i + 3] > 0) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      setLatexPosition({ x: centerX, y: centerY });
    }
  };

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Button
          onClick={() => setReset(true)}
          className="z-20 bg-black text-white"
          variant="destructive"
          color="black"
        >
          Reset
        </Button>
        <Group className="z-20">
          {SWATCHES.map((swatch) => (
            <ColorSwatch
              key={swatch}
              color={swatch}
              onClick={() => setColor(swatch)}
            />
          ))}
        </Group>
        <Button
          onClick={runRoute}
          className="z-20 bg-black text-white"
          variant="default"
          color="white"
        >
          Run
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        id="canvas"
        className="absolute top-0 left-0 w-full h-full"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />

      {latexExpressions.map((latex, index) => (
        <Draggable
          key={index}
          defaultPosition={latexPosition}
          onStop={(e, data) => {
            console.log(e.target);
            return setLatexPosition({ x: data.x, y: data.y });
          }}
        >
          <div className="absolute p-2 text-white rounded shadow-md">
            <div className="latex-content">{latex}</div>
          </div>
        </Draggable>
      ))}
    </>
  );
}