from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.claim import Claim





T = TypeVar("T", bound="ClaimResult")



@_attrs_define
class ClaimResult:
    """ 
        Attributes:
            claim (Claim | None):
     """

    claim: Claim | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.claim import Claim # noqa: PLC0415
        claim: dict[str, Any] | None
        if isinstance(self.claim, Claim):
            claim = self.claim.to_dict()
        else:
            claim = self.claim


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "claim": claim,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.claim import Claim # noqa: PLC0415
        d = dict(src_dict)
        def _parse_claim(data: object) -> Claim | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                claim_type_0 = Claim.from_dict(data)



                return claim_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(Claim | None, data)

        claim = _parse_claim(d.pop("claim"))


        claim_result = cls(
            claim=claim,
        )

        return claim_result

