from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.mail_handler import MailHandler





T = TypeVar("T", bound="ProjectsGetMailHandlerResponse200")



@_attrs_define
class ProjectsGetMailHandlerResponse200:
    """ 
        Attributes:
            handler (MailHandler | None):
     """

    handler: MailHandler | None





    def to_dict(self) -> dict[str, Any]:
        from ..models.mail_handler import MailHandler # noqa: PLC0415
        handler: dict[str, Any] | None
        if isinstance(self.handler, MailHandler):
            handler = self.handler.to_dict()
        else:
            handler = self.handler


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "handler": handler,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.mail_handler import MailHandler # noqa: PLC0415
        d = dict(src_dict)
        def _parse_handler(data: object) -> MailHandler | None:
            if data is None:
                return data
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                handler_type_0 = MailHandler.from_dict(data)



                return handler_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            return cast(MailHandler | None, data)

        handler = _parse_handler(d.pop("handler"))


        projects_get_mail_handler_response_200 = cls(
            handler=handler,
        )

        return projects_get_mail_handler_response_200

