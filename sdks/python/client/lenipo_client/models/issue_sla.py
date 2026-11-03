from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.sla_metric import SlaMetric





T = TypeVar("T", bound="IssueSla")



@_attrs_define
class IssueSla:
    """ 
        Attributes:
            first_response (None | SlaMetric):
            resolution (None | SlaMetric):
     """

    first_response: None | SlaMetric
    resolution: None | SlaMetric





    def to_dict(self) -> dict[str, Any]:
        from ..models.sla_metric import SlaMetric # noqa: PLC0415
        first_response: dict[str, Any] | None
        if isinstance(self.first_response, SlaMetric):
            first_response = self.first_response.to_dict()
        else:
            first_response = self.first_response

        resolution: dict[str, Any] | None
        if isinstance(self.resolution, SlaMetric):
            resolution = self.resolution.to_dict()
        else:
            resolution = self.resolution


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "firstResponse": first_response,
            "resolution": resolution,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.sla_metric import SlaMetric # noqa: PLC0415
        d = dict(src_dict)
        def _parse_first_response(data: object) -> None | SlaMetric:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                first_response_type_0 = SlaMetric.from_dict(data)



                return first_response_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | SlaMetric, data)

        first_response = _parse_first_response(d.pop("firstResponse"))


        def _parse_resolution(data: object) -> None | SlaMetric:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                resolution_type_0 = SlaMetric.from_dict(data)



                return resolution_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(None | SlaMetric, data)

        resolution = _parse_resolution(d.pop("resolution"))


        issue_sla = cls(
            first_response=first_response,
            resolution=resolution,
        )

        return issue_sla

