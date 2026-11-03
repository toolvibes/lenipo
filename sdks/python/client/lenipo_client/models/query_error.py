from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.query_error_params import QueryErrorParams





T = TypeVar("T", bound="QueryError")



@_attrs_define
class QueryError:
    """ 
        Attributes:
            code (str):
            message (str):
            start (int):
            end (int):
            params (QueryErrorParams):
     """

    code: str
    message: str
    start: int
    end: int
    params: QueryErrorParams





    def to_dict(self) -> dict[str, Any]:
        from ..models.query_error_params import QueryErrorParams # noqa: PLC0415
        code = self.code

        message = self.message

        start = self.start

        end = self.end

        params = self.params.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "code": code,
            "message": message,
            "start": start,
            "end": end,
            "params": params,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.query_error_params import QueryErrorParams # noqa: PLC0415
        d = dict(src_dict)
        code = d.pop("code")

        message = d.pop("message")

        start = d.pop("start")

        end = d.pop("end")

        params = QueryErrorParams.from_dict(d.pop("params"))




        query_error = cls(
            code=code,
            message=message,
            start=start,
            end=end,
            params=params,
        )

        return query_error

