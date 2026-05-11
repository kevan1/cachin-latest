import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function QrRailSelectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const amount = firstParam(params.amount);
  const amountUsdc = firstParam(params.amountUsdc);
  const arsRate = firstParam(params.arsRate);
  const paymentAddress = firstParam(params.paymentAddress);
  const rawQr = firstParam(params.rawQr);

  useEffect(() => {
    router.replace({
      pathname: "/qr-payment-confirm" as never,
      params: {
        method: "mercadopago",
        currency: "ARS",
        rail: "p2p",
        amount,
        amountUsdc,
        arsRate,
        paymentAddress,
        rawQr,
      },
    });
  }, [amount, amountUsdc, arsRate, paymentAddress, rawQr, router]);

  return null;
}
