from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.issue_sla import IssueSla





T = TypeVar("T", bound="ServiceDeskIssueSlaResponse200")



@_attrs_define
class ServiceDeskIssueSlaResponse200:
    """ 
        Attributes:
            sla (IssueSla | None):
     """

    sla: IssueSla | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.issue_sla import IssueSla # noqa: PLC0415
        sla: dict[str, Any] | None
        if isinstance(self.sla, IssueSla):
            sla = self.sla.to_dict()
        else:
            sla = self.sla


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "sla": sla,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.issue_sla import IssueSla # noqa: PLC0415
        d = dict(src_dict)
        def _parse_sla(data: object) -> IssueSla | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                sla_type_0 = IssueSla.from_dict(data)



                return sla_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(IssueSla | None, data)

        sla = _parse_sla(d.pop("sla"))


        service_desk_issue_sla_response_200 = cls(
            sla=sla,
        )

        return service_desk_issue_sla_response_200

