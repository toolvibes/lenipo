from http import HTTPStatus
from typing import Any, cast
from urllib.parse import quote

import httpx

from ...client import AuthenticatedClient, Client
from ...types import Response, UNSET
from ... import errors

from ...models.problem import Problem
from ...models.review_request import ReviewRequest
from ...models.review_verdict_request import ReviewVerdictRequest
from typing import cast



def _get_kwargs(
    id: str,
    *,
    body: ReviewVerdictRequest,

) -> dict[str, Any]:
    headers: dict[str, Any] = {}


    

    

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/api/v1/reviews/{id}/verdict".format(id=quote(str(id), safe=""),),
    }

    _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs



def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Problem | ReviewRequest:
    if response.status_code == 200:
        response_200 = ReviewRequest.from_dict(response.json())



        return response_200

    response_default = Problem.from_dict(response.json())



    return response_default



def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Problem | ReviewRequest]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: ReviewVerdictRequest,

) -> Response[Problem | ReviewRequest]:
    """ Give the verdict of a review

     Writes a review comment on the issue, tells the requester and moves the issue to the status the
    project set for this verdict, if any. Post in the pull request yourself; Lenipo does not write to
    the git host.

    Args:
        id (str):
        body (ReviewVerdictRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ReviewRequest]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)

def sync(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: ReviewVerdictRequest,

) -> Problem | ReviewRequest | None:
    """ Give the verdict of a review

     Writes a review comment on the issue, tells the requester and moves the issue to the status the
    project set for this verdict, if any. Post in the pull request yourself; Lenipo does not write to
    the git host.

    Args:
        id (str):
        body (ReviewVerdictRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ReviewRequest
     """


    return sync_detailed(
        id=id,
client=client,
body=body,

    ).parsed

async def asyncio_detailed(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: ReviewVerdictRequest,

) -> Response[Problem | ReviewRequest]:
    """ Give the verdict of a review

     Writes a review comment on the issue, tells the requester and moves the issue to the status the
    project set for this verdict, if any. Post in the pull request yourself; Lenipo does not write to
    the git host.

    Args:
        id (str):
        body (ReviewVerdictRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Problem | ReviewRequest]
     """


    kwargs = _get_kwargs(
        id=id,
body=body,

    )

    response = await client.get_async_httpx_client().request(
        **kwargs
    )

    return _build_response(client=client, response=response)

async def asyncio(
    id: str,
    *,
    client: AuthenticatedClient | Client,
    body: ReviewVerdictRequest,

) -> Problem | ReviewRequest | None:
    """ Give the verdict of a review

     Writes a review comment on the issue, tells the requester and moves the issue to the status the
    project set for this verdict, if any. Post in the pull request yourself; Lenipo does not write to
    the git host.

    Args:
        id (str):
        body (ReviewVerdictRequest):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Problem | ReviewRequest
     """


    return (await asyncio_detailed(
        id=id,
client=client,
body=body,

    )).parsed
