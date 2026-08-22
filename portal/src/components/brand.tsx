import Image from "next/image";

export function Brand() {
  return (
    <div className="brand" aria-label="Abhay Hostel Student Portal">
      <Image
        src="/abhay-hostel-logo.png"
        width={76}
        height={74}
        alt="Abhay Hostel logo"
        priority
      />
      <div>
        <strong>Abhay Hostel</strong>
        <span>Student Portal</span>
      </div>
    </div>
  );
}
